"""Ansible Wrapper - 自動解密 SSH key 後執行 ansible 命令"""

import atexit
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from .vault import decrypt_vault, extract_ssh_private_key

ROOT_DIR = Path(__file__).parent.parent


def run_ansible(args: list[str]) -> int:
    """
    解密 SSH key 後執行 ansible 命令

    Args:
        args: ansible 命令參數（如 ["ansible-playbook", "ansible/playbooks/deploy-bot.yml"]）

    Returns:
        命令返回碼
    """
    # 解密 vault 取得 SSH key
    vault = decrypt_vault()
    ssh_key = extract_ssh_private_key(vault)

    # 寫入臨時檔案
    fd, key_file = tempfile.mkstemp(prefix=".pai_key_", text=True)
    try:
        os.write(fd, ssh_key.encode())
        os.close(fd)
        os.chmod(key_file, 0o600)

        # 註冊清理
        def cleanup():
            try:
                os.unlink(key_file)
            except OSError:
                pass

        atexit.register(cleanup)

        # 設定環境變數
        env = os.environ.copy()
        env["PAI_SSH_KEY_FILE"] = key_file

        # 執行 ansible 命令
        result = subprocess.run(args, cwd=ROOT_DIR, env=env)
        return result.returncode

    finally:
        # 確保清理
        try:
            os.unlink(key_file)
        except OSError:
            pass


def main():
    """CLI 入口點"""
    if len(sys.argv) < 2:
        print("用法: uv run python -m scripts.ansible <ansible-command> [args...]")
        print("範例: uv run python -m scripts.ansible ansible-playbook \\")
        print("      ansible/playbooks/deploy-bot.yml")
        sys.exit(1)

    sys.exit(run_ansible(sys.argv[1:]))


if __name__ == "__main__":
    main()
