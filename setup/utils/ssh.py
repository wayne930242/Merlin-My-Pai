"""SSH Key 工具"""

import tempfile
from pathlib import Path

from .command import run_command


def generate_ssh_key() -> tuple[str, str] | tuple[None, None]:
    """產生 SSH Key，回傳 (private_key, public_key)"""
    with tempfile.TemporaryDirectory() as tmpdir:
        key_path = Path(tmpdir) / "pai-agent"
        result = run_command([
            "ssh-keygen",
            "-t", "ed25519",
            "-C", "pai-agent",
            "-f", str(key_path),
            "-N", "",
        ])

        if not result or result.returncode != 0:
            return None, None

        private_key = key_path.read_text()
        public_key = Path(f"{key_path}.pub").read_text().strip()

    return private_key, public_key
