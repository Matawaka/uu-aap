#!/usr/bin/env python3
"""Narrow GitHub REST provider adapter for CHSP v1.0.

Only collaborator-permission observation and bounded role elevation are implemented.
No ownership transfer, access removal, credential rotation, ref/content mutation, release
publication, canonical-origin mutation, or KONTUR surface exists here.
"""
from __future__ import annotations

import hashlib
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

SYSTEM_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
USER_RE = re.compile(r"^[A-Za-z0-9-]{1,39}$")
ROLE_RANK = {"absent":0,"identity_only":1,"collaborator":2,"maintainer":3,"admin":4,"owner":5,"unknown":-1}
PERMISSION_TO_ROLE = {
    "none":"absent","read":"identity_only","triage":"identity_only","write":"collaborator",
    "maintain":"maintainer","admin":"admin",
}
ROLE_TO_PERMISSION = {"identity_only":"pull","collaborator":"push","maintainer":"maintain"}


def _digest(value: dict[str, Any]) -> str:
    raw = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def parse_target(envelope: dict[str, Any]) -> tuple[str, str, str]:
    if envelope.get("external_system_type") != "github_repository":
        raise ValueError("GitHub adapter requires github_repository target")
    system_id = envelope.get("external_system_id", "")
    if SYSTEM_RE.fullmatch(system_id) is None:
        raise ValueError("invalid GitHub repository identifier")
    principal = envelope.get("external_principal_id", "")
    if not principal.startswith("github:"):
        raise ValueError("GitHub principal must use github:<login>")
    login = principal.split(":", 1)[1]
    if USER_RE.fullmatch(login) is None:
        raise ValueError("invalid GitHub login")
    owner, repo = system_id.split("/", 1)
    return owner, repo, login


class GitHubRestAdapter:
    adapter_id = "github-rest-collaborator-v1.0"

    def __init__(self, token: str, api_base: str = "https://api.github.com", timeout_seconds: int = 10):
        if not isinstance(token, str) or len(token) < 8:
            raise ValueError("runtime GitHub credential missing")
        self._token = token
        self._api_base = api_base.rstrip("/")
        self._timeout = timeout_seconds
        self._target: tuple[str, str, str] | None = None

    def _request(self, method: str, path: str, payload: dict[str, Any] | None = None) -> tuple[int, dict[str, Any], str | None]:
        body = None if payload is None else json.dumps(payload, separators=(",", ":")).encode("utf-8")
        req = urllib.request.Request(
            self._api_base + path,
            data=body,
            method=method,
            headers={
                "Authorization":"Bearer " + self._token,
                "Accept":"application/vnd.github+json",
                "X-GitHub-Api-Version":"2022-11-28",
                "User-Agent":"uu-aap-chsp-v1.0",
                "Content-Type":"application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as response:
                raw = response.read()
                parsed = json.loads(raw.decode("utf-8")) if raw else {}
                return response.status, parsed if isinstance(parsed, dict) else {}, response.headers.get("X-GitHub-Request-Id")
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return 404, {}, exc.headers.get("X-GitHub-Request-Id") if exc.headers else None
            raise RuntimeError(f"GitHub provider request failed with HTTP {exc.code}") from None
        except urllib.error.URLError:
            raise RuntimeError("GitHub provider request failed") from None

    def observe(self, envelope: dict[str, Any]) -> dict[str, Any]:
        owner, repo, login = parse_target(envelope)
        self._target = (owner, repo, login)
        path = "/repos/{}/{}/collaborators/{}/permission".format(
            urllib.parse.quote(owner, safe=""), urllib.parse.quote(repo, safe=""), urllib.parse.quote(login, safe="")
        )
        status, data, request_id = self._request("GET", path)
        if status == 404:
            role, permission = "absent", "none"
        else:
            permission = str(data.get("permission", "")).lower()
            role = PERMISSION_TO_ROLE.get(permission, "unknown")
        sanitized = {"provider":"github","repository":f"{owner}/{repo}","principal":login,"http_status":status,"permission":permission,"role":role,"request_id":request_id}
        return {"role":role,"evidence_sha256":_digest(sanitized),"request_id":request_id}

    def preflight(self, op: dict[str, Any], observation: dict[str, Any], policy: dict[str, Any]) -> dict[str, Any]:
        role = observation.get("role", "unknown")
        kind = op.get("kind")
        if role == "unknown":
            return {"supported":False,"mutation_needed":False,"projected_role":role,"reason":"provider role unknown"}
        if kind == "ensure_principal_presence":
            return {"supported": role != "absent", "mutation_needed":False,"projected_role":role,"reason":"presence already verified" if role != "absent" else "presence-only operation cannot invite without an explicit bounded role"}
        if kind == "ensure_release_signer_binding":
            return {"supported":False,"mutation_needed":False,"projected_role":role,"reason":"GitHub collaborator API does not establish release-signing identity"}
        if kind != "ensure_role_at_least":
            return {"supported":False,"mutation_needed":False,"projected_role":role,"reason":"operation not implemented by GitHub adapter"}
        target = op.get("intended_role")
        if target not in ROLE_TO_PERMISSION:
            return {"supported":False,"mutation_needed":False,"projected_role":role,"reason":"target role is not executable by GitHub v1.0 adapter"}
        if ROLE_RANK[target] > ROLE_RANK[policy["maximum_executable_role"]]:
            return {"supported":False,"mutation_needed":False,"projected_role":role,"reason":"target role exceeds policy cap"}
        if ROLE_RANK.get(role, -1) >= ROLE_RANK[target]:
            return {"supported":True,"mutation_needed":False,"projected_role":role,"reason":"role already satisfies target"}
        return {"supported":True,"mutation_needed":True,"projected_role":target,"reason":"bounded collaborator role elevation required"}

    def apply(self, op: dict[str, Any], observation: dict[str, Any], policy: dict[str, Any]) -> dict[str, Any]:
        plan = self.preflight(op, observation, policy)
        if not plan["supported"]:
            raise ValueError("operation failed GitHub adapter preflight")
        if not plan["mutation_needed"]:
            return {"status":"already_satisfied","mutation_attempted":False,"mutation_performed":False,"observation":observation,"request_id":observation.get("request_id"),"reason":plan["reason"]}
        if self._target is None:
            raise RuntimeError("provider target was not observed before mutation")
        owner, repo, login = self._target
        target = op["intended_role"]
        path = "/repos/{}/{}/collaborators/{}".format(
            urllib.parse.quote(owner, safe=""), urllib.parse.quote(repo, safe=""), urllib.parse.quote(login, safe="")
        )
        _, _, request_id = self._request("PUT", path, {"permission":ROLE_TO_PERMISSION[target]})
        after = self.observe({"external_system_type":"github_repository","external_system_id":f"{owner}/{repo}","external_principal_id":f"github:{login}"})
        if ROLE_RANK.get(after["role"], -1) < ROLE_RANK[target]:
            return {"status":"verification_failed","mutation_attempted":True,"mutation_performed":True,"observation":after,"request_id":request_id,"reason":"provider mutation returned but target role was not re-observed"}
        return {"status":"changed","mutation_attempted":True,"mutation_performed":True,"observation":after,"request_id":request_id,"reason":"bounded collaborator role elevation verified"}
