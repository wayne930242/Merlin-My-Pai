"""SSH Key 工具"""

import tempfile
from pathlib import Path

from .command import run_command


def validate_ssh_private_key_path(path: str) -> tuple[bool, str]:
    """
    驗證 SSH 私鑰路徑

    Returns:
        (is_valid, message): (是否有效, 錯誤訊息或警告)
    """
    # 檢查是否為公鑰路徑
    if path.endswith(".pub"):
        private_path = path[:-4]  # 移除 .pub
        return (
            False,
            f"❌ 這是公鑰路徑！請改用私鑰：\n   {private_path}\n   提示：私鑰檔案沒有 .pub 副檔名",
        )

    # 展開 ~ 並檢查存在
    expanded = Path(path).expanduser()
    if not expanded.exists():
        return False, f"❌ 檔案不存在: {path}\n   請確認路徑是否正確"

    # 檢查是否為檔案
    if not expanded.is_file():
        return False, f"❌ 這不是檔案: {path}"

    # 檢查權限（建議 0600，但允許 0400）
    mode = expanded.stat().st_mode & 0o777
    if mode not in (0o600, 0o400):
        return (
            False,
            f"⚠️  權限不安全: {path} 是 {oct(mode)}\n   SSH 要求私鑰權限為 0600 或 0400\n   執行: chmod 600 {path}",
        )

    # 簡單檢查是否為 SSH 私鑰格式
    try:
        with open(expanded, "r") as f:
            content = f.read()
        if not content.startswith("-----BEGIN"):
            return False, f"❌ 這不像是 SSH 私鑰檔案\n   私鑰應該以 '-----BEGIN' 開頭"
    except Exception as e:
        return False, f"❌ 無法讀取檔案: {e}"

    return True, "✓ SSH 私鑰路徑有效"


def generate_ssh_key() -> tuple[str, str] | tuple[None, None]:
    """產生 SSH Key，回傳 (private_key, public_key)"""
    with tempfile.TemporaryDirectory() as tmpdir:
        key_path = Path(tmpdir) / "pai-agent"
        result = run_command(
            [
                "ssh-keygen",
                "-t",
                "ed25519",
                "-C",
                "pai-agent",
                "-f",
                str(key_path),
                "-N",
                "",
            ]
        )

        if not result or result.returncode != 0:
            return None, None

        private_key = key_path.read_text()
        public_key = Path(f"{key_path}.pub").read_text().strip()

    return private_key, public_key
