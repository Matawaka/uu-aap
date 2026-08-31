#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import http.server
import json
import socketserver
import tempfile
import threading
from pathlib import Path

import verify_deployed as observer


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def make_root(base: Path) -> dict:
    files = {
        ".nojekyll": b"",
        "index.html": b"<h1>x</h1>\n",
        "verifier/a.js": b"console.log(1);\n",
    }
    for rel, data in files.items():
        path = base / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    envelope = {
        "schema": observer.ENVELOPE_SCHEMA,
        "predecessor_main": "synthetic",
        "source_bindings": {},
        "payload_file_count": len(files),
        "payload_tree_sha256": "0" * 64,
        "p1_15_composition_receipt": {},
        "files": [
            {"path": rel, "bytes": len(data), "sha256": sha256(data)}
            for rel, data in sorted(files.items())
        ],
        "verification_scope": "relocated_byte_consistency_against_this_envelope",
        "non_effects": {"producer_authenticated": False},
    }
    (base / observer.ENVELOPE_NAME).write_text(json.dumps(envelope, indent=2) + "\n", encoding="utf-8")
    return envelope


class LocalServer:
    def __init__(self, root: Path, *, overrides=None, redirects=None):
        self.root = root
        self.overrides = overrides or {}
        self.redirects = redirects or {}

    def __enter__(self):
        root = self.root
        overrides = self.overrides
        redirects = self.redirects

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                rel = self.path.split("?", 1)[0].lstrip("/")
                if rel in redirects:
                    self.send_response(302)
                    self.send_header("Location", redirects[rel])
                    self.end_headers()
                    return
                if rel in overrides:
                    data = overrides[rel]
                    if data is None:
                        self.send_error(404)
                        return
                else:
                    path = root / rel
                    if not path.is_file():
                        self.send_error(404)
                        return
                    data = path.read_bytes()
                self.send_response(200)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def log_message(self, *_args):
                return

        self.httpd = socketserver.TCPServer(("127.0.0.1", 0), Handler)
        self.port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        return self

    def __exit__(self, *_args):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join()

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.port}/"


def expect_reject(callable_obj, label: str) -> None:
    try:
        callable_obj()
    except Exception:
        return
    raise AssertionError(f"expected reject: {label}")


def main() -> None:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        envelope = make_root(root)
        expected_raw, _ = observer.load_expected_envelope(root)

        with LocalServer(root) as server:
            observed = observer.observe_once(expected_raw, envelope, base_url=server.url, cache_bust="exact", timeout=2)
            assert len(observed["files"]) == 3
            receipt = observer.observe_with_retry(
                root,
                base_url=server.url,
                triggering_run_id="1",
                head_sha="a" * 40,
                artifact_id="2",
                artifact_digest="sha256:" + "b" * 64,
                max_attempts=1,
                retry_seconds=0,
                timeout=2,
            )
            assert receipt["all_envelope_listed_payload_bytes_matched"] is True
            assert receipt["observation_time_is_trusted_timestamp"] is False
            assert all(value is False for value in receipt["non_effects"].values())

        with LocalServer(root, overrides={"index.html": b"<h1>y</h1>\n"}) as server:
            expect_reject(
                lambda: observer.observe_once(expected_raw, envelope, base_url=server.url, cache_bust="drift", timeout=2),
                "payload byte drift",
            )
        with LocalServer(root, overrides={"index.html": None}) as server:
            expect_reject(
                lambda: observer.observe_once(expected_raw, envelope, base_url=server.url, cache_bust="missing", timeout=2),
                "missing payload",
            )
        drifted_envelope = bytearray(expected_raw)
        drifted_envelope[-2:-1] = b" "
        with LocalServer(root, overrides={observer.ENVELOPE_NAME: bytes(drifted_envelope)}) as server:
            expect_reject(
                lambda: observer.observe_once(expected_raw, envelope, base_url=server.url, cache_bust="envelope", timeout=2),
                "remote envelope drift",
            )
        same_size = b"<h1>z</h1>\n"
        assert len(same_size) == len((root / "index.html").read_bytes())
        with LocalServer(root, overrides={"index.html": same_size}) as server:
            expect_reject(
                lambda: observer.observe_once(expected_raw, envelope, base_url=server.url, cache_bust="same-size", timeout=2),
                "same-size SHA drift",
            )
        with LocalServer(root) as other:
            with LocalServer(root, redirects={"index.html": other.url + "index.html"}) as server:
                expect_reject(
                    lambda: observer.observe_once(expected_raw, envelope, base_url=server.url, cache_bust="redirect", timeout=2),
                    "cross-origin redirect",
                )

        broken = json.loads(expected_raw)
        broken["files"].append(dict(broken["files"][0]))
        broken["payload_file_count"] += 1
        (root / observer.ENVELOPE_NAME).write_text(json.dumps(broken), encoding="utf-8")
        expect_reject(lambda: observer.load_expected_envelope(root), "duplicate manifest path")

    print("P1.18 exact envelope + payloads: PASS")
    print("P1.18 payload/envelope/missing/hash/redirect/path adversarial rejection: PASS")
    print("P1.18 observation receipt non-effects remain false: PASS")


if __name__ == "__main__":
    main()
