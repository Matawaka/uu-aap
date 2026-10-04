# SPDX-License-Identifier: Apache-2.0
"""Linux namespace probe for a fixed synthetic worker, never an arbitrary launcher.

No fallback to unrestricted execution. This is a narrow capability observation,
not qualification of a hostile native runtime, kernel, provider or production VM.
"""
import argparse
import json
import os
from pathlib import Path
try:
    import resource
except ImportError:
    resource = None
import shutil
import socket
import subprocess
import sys
import tempfile


def command(bwrap, python, source, canary, port):
    argv = [bwrap, "--unshare-all", "--die-with-parent", "--new-session", "--cap-drop", "ALL", "--clearenv"]
    for name in ("/usr", "/lib", "/lib64"):
        if Path(name).exists():
            argv += ["--ro-bind", name, name]
    argv += ["--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp", "--dir", "/work",
             "--ro-bind", str(source), "/source", "--ro-bind", str(canary), "/readonly-canary",
             "--chdir", "/work", "--setenv", "PATH", "/usr/local/bin:/usr/bin:/bin",
             "--setenv", "HOME", "/work", "--", python, "-I", "-B", "/source/isolation.py",
             "--worker", str(port)]
    return argv


def limits():
    resource.setrlimit(resource.RLIMIT_CPU, (5, 5))
    resource.setrlimit(resource.RLIMIT_AS, (256 * 1024**2, 256 * 1024**2))
    resource.setrlimit(resource.RLIMIT_FSIZE, (65536, 65536))
    resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


def worker(port):
    net_namespace = os.readlink("/proc/self/ns/net")
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=.3):
            connected = True
    except OSError:
        connected = False
    try:
        Path("/readonly-canary").write_text("changed")
        denied = False
    except OSError:
        denied = True
    print(json.dumps({"host_endpoint_reached": connected, "readonly_write_denied": denied,
                      "synthetic_secret_present": "MATAWAKA_PROBE_SECRET" in os.environ,
                      "net_namespace": net_namespace}))


def _probe():
    base = {"schema": "matawaka.intermediary.isolation-probe/v0.1", "profile": "linux-bwrap-fixed-probe",
            "arbitrary_workload_qualified": False, "production_isolation_established": False,
            "no_unisolated_fallback": True}
    if sys.platform != "linux" or not shutil.which("bwrap"):
        return {**base, "status": "UNAVAILABLE", "reason": "LINUX_BWRAP_REQUIRED"}
    if not Path("/usr/bin/python3").is_file():
        return {**base, "status": "UNAVAILABLE", "reason": "SYSTEM_PYTHON_REQUIRED"}
    with tempfile.TemporaryDirectory(prefix="intermediary-isolation-") as directory:
        directory = Path(directory)
        canary = directory / "canary"
        canary.write_bytes(b"unchanged")
        with socket.socket() as server:
            server.bind(("127.0.0.1", 0))
            server.listen(4)
            port = server.getsockname()[1]
            # Host positive control differentiates unavailable endpoint from denial.
            with socket.create_connection(("127.0.0.1", port), timeout=1):
                pass
            connection, _ = server.accept()
            connection.close()
            argv = command(shutil.which("bwrap"), "/usr/bin/python3", Path(__file__).resolve().parent, canary, port)
            env = {"PATH": "/usr/local/bin:/usr/bin:/bin", "MATAWAKA_PROBE_SECRET": "synthetic-canary-only"}
            with (directory / "stdout").open("wb") as out, (directory / "stderr").open("wb") as err:
                try:
                    result = subprocess.run(argv, env=env, stdin=subprocess.DEVNULL, stdout=out, stderr=err,
                                            timeout=10, preexec_fn=limits, start_new_session=True)
                except (OSError, subprocess.TimeoutExpired):
                    return {**base, "status": "UNAVAILABLE", "reason": "ISOLATED_PROCESS_NOT_COMPLETED"}
            if result.returncode != 0:
                return {**base, "status": "UNAVAILABLE", "reason": "NAMESPACE_SETUP_OR_WORKER_FAILED", "exit_code": result.returncode}
            try:
                observed = json.loads((directory / "stdout").read_bytes())
                passed = (observed["host_endpoint_reached"] is False and observed["readonly_write_denied"] is True
                          and observed["synthetic_secret_present"] is False and canary.read_bytes() == b"unchanged"
                          and observed["net_namespace"] != os.readlink("/proc/self/ns/net"))
            except (ValueError, KeyError, TypeError):
                passed = False
            return {**base, "status": "PROBE_PASS_BOUNDED" if passed else "PROBE_FAILED",
                    "host_positive_control": True, "parent_canary_unchanged": canary.read_bytes() == b"unchanged"}


def probe():
    try:
        return _probe()
    except OSError:
        return {"schema": "matawaka.intermediary.isolation-probe/v0.1", "status": "UNAVAILABLE",
                "reason": "HOST_PREFLIGHT_DENIED", "arbitrary_workload_qualified": False,
                "production_isolation_established": False, "no_unisolated_fallback": True}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--worker", type=int)
    args = parser.parse_args()
    if args.worker is not None:
        worker(args.worker)
    else:
        result = probe()
        print(json.dumps(result, indent=2))
        raise SystemExit(0 if result["status"] == "PROBE_PASS_BOUNDED" else 2)
