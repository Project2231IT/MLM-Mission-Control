"""
Remote file sync — writes state/config files to Argus VM over SSH.
Both barista-monitor and people-counter use this to keep data on Argus
while running inference locally on the GPU host.
"""

import subprocess
import json
import os
import time
import threading

ARGUS_HOST = "mrcrabs@172.16.201.23"
ARGUS_DATA = "/home/mrcrabs/argus/data"

# Debounce writes — don't SCP more than once per interval
_last_write: dict[str, float] = {}
_write_lock = threading.Lock()


def read_remote_json(remote_path: str) -> dict | list | None:
    """Read a JSON file from Argus."""
    try:
        result = subprocess.run(
            ["ssh", ARGUS_HOST, f"cat {remote_path}"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0 and result.stdout.strip():
            return json.loads(result.stdout)
    except Exception as e:
        print(f"[remote_sync] Failed to read {remote_path}: {e}")
    return None


def write_remote_json(remote_path: str, data, min_interval: float = 0.5):
    """Write JSON data to a file on Argus. Debounced by min_interval seconds."""
    with _write_lock:
        now = time.time()
        if remote_path in _last_write and (now - _last_write[remote_path]) < min_interval:
            return
        _last_write[remote_path] = now

    try:
        payload = json.dumps(data)
        result = subprocess.run(
            ["ssh", ARGUS_HOST, f"cat > {remote_path}"],
            input=payload, text=True, capture_output=True, timeout=10
        )
        if result.returncode != 0:
            print(f"[remote_sync] Write failed for {remote_path}: {result.stderr}")
    except Exception as e:
        print(f"[remote_sync] Failed to write {remote_path}: {e}")


def write_remote_binary(remote_path: str, data: bytes, min_interval: float = 0.3):
    """Write binary data (e.g. JPEG frame) to Argus."""
    with _write_lock:
        now = time.time()
        if remote_path in _last_write and (now - _last_write[remote_path]) < min_interval:
            return
        _last_write[remote_path] = now

    try:
        result = subprocess.run(
            ["ssh", ARGUS_HOST, f"cat > {remote_path}"],
            input=data, capture_output=True, timeout=10
        )
        if result.returncode != 0:
            print(f"[remote_sync] Binary write failed for {remote_path}: {result.stderr}")
    except Exception as e:
        print(f"[remote_sync] Failed to write binary {remote_path}: {e}")


def scp_to_remote(local_path: str, remote_path: str):
    """SCP a local file to Argus."""
    try:
        subprocess.run(
            ["scp", "-q", local_path, f"{ARGUS_HOST}:{remote_path}"],
            capture_output=True, timeout=15
        )
    except Exception as e:
        print(f"[remote_sync] SCP failed: {e}")
