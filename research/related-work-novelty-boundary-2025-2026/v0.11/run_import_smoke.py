#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib
import importlib.metadata
import json
import os
import socket
import sys
from pathlib import Path

CREDENTIAL_VARS = (
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_API_KEY",
    "GEMINI_API_KEY",
    "HF_TOKEN",
    "HUGGING_FACE_HUB_TOKEN",
)
OFFLINE_VARS = (
    "HF_HUB_OFFLINE",
    "HF_DATASETS_OFFLINE",
    "TRANSFORMERS_OFFLINE",
)
IMPORTS = (
    ("statebench", "statebench"),
    ("lm_eval", "lm_eval"),
    ("datasets", "datasets"),
    ("torch", "torch"),
    ("transformers", "transformers"),
    ("accelerate", "accelerate"),
    ("peft", "peft"),
)


def fail(message: str) -> None:
    raise RuntimeError(message)


def install_network_guard() -> None:
    class GuardedSocket(socket.socket):
        def connect(self, *args, **kwargs):  # type: ignore[override]
            fail("network connect attempted during import smoke")

        def connect_ex(self, *args, **kwargs):  # type: ignore[override]
            fail("network connect_ex attempted during import smoke")

    def blocked(*args, **kwargs):
        fail("network resolution/connection attempted during import smoke")

    socket.socket = GuardedSocket  # type: ignore[assignment]
    socket.create_connection = blocked  # type: ignore[assignment]
    socket.getaddrinfo = blocked  # type: ignore[assignment]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    present_credentials = [name for name in CREDENTIAL_VARS if os.environ.get(name)]
    if present_credentials:
        fail(f"credential evidence present: {present_credentials}")

    offline = {name: os.environ.get(name) for name in OFFLINE_VARS}
    if any(value != "1" for value in offline.values()):
        fail(f"offline controls are not all enabled: {offline}")

    install_network_guard()

    imported = []
    for module_name, dist_name in IMPORTS:
        module = importlib.import_module(module_name)
        version = importlib.metadata.version(dist_name)
        imported.append(
            {
                "module": module_name,
                "distribution": dist_name,
                "version": version,
                "imported": module is not None,
            }
        )

    result = {
        "schema": "matawaka.statebench-frozen-sync-import-result/v0.11",
        "status": "FROZEN_SYNC_AND_IMPORT_SMOKE_EXECUTED",
        "python": sys.version.split()[0],
        "network_guard_active": True,
        "offline_controls": offline,
        "credentials_present": [],
        "imports": imported,
        "non_effects": {
            "language_model_executed": False,
            "statebench_task_loaded": False,
            "dataset_loaded": False,
            "dataset_downloaded": False,
            "huggingface_model_downloaded": False,
            "provider_api_called": False,
            "user_credentials_used": False,
            "official_statebench_benchmark_executed": False,
            "model_performance_established": False,
            "merge_authorized": False,
        },
    }
    Path(args.output).write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
