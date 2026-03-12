"""
PRISM Data Sync — Pushes local PRISM data to the deployed dashboard.
Run locally: python3 sync.py

This reads local JSONL files and POSTs them to the deployed API,
so the dashboard has access to PRISM data without direct file access.
"""

import os
import json
import httpx
from pathlib import Path

PRISM_DIR = os.environ.get(
    'PRISM_DATA_DIR',
    '/Users/faisal/.openclaw/workspace/neo_quant/data'
)
DASHBOARD_URL = os.environ.get('DASHBOARD_URL', 'http://localhost:8000')

FILES_TO_SYNC = [
    'prism_regime_gate.jsonl',
    'prism_signal_log.jsonl',
    'prism_pnl_decomposition.jsonl',
]


def sync():
    """Push local PRISM data files to the dashboard API."""
    for fname in FILES_TO_SYNC:
        path = os.path.join(PRISM_DIR, fname)
        if not os.path.exists(path):
            print(f"  Skip {fname} (not found)")
            continue
        
        with open(path) as f:
            lines = [json.loads(line) for line in f if line.strip()]
        
        print(f"  Syncing {fname}: {len(lines)} entries")
        
        resp = httpx.post(
            f"{DASHBOARD_URL}/api/sync/{fname}",
            json=lines,
            timeout=30,
        )
        print(f"    Status: {resp.status_code}")


if __name__ == '__main__':
    print(f"Syncing PRISM data from {PRISM_DIR} to {DASHBOARD_URL}")
    sync()
    print("Done.")
