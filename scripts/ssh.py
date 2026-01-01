"""SSH 工具 - 連線到 VPS 和設定 SSH config"""

import atexit
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from .vault import decrypt_vault, extract_ssh_private_key

SSH_KEY_FILE = Path.home() / ".ssh" / "pai-agent"
SSH_CONFIG = Path.home() / ".ssh" / "config"


def ssh_to_vps(command: str | None = None) -> int:
    """
    SSH 連線到 VPS

    Args:
        command: 要執行的命令（None 表示互動式登入）

    Returns:
        命令返回碼
    """
    vault = decrypt_vault()
    ssh_key = extract_ssh_private_key(vault)
    server_ip = vault.get("vault_server_ip")

    if not server_ip:
        print("錯誤：vault 中缺少 vault_server_ip", file=sys.stderr)
        return 1

    # 寫入臨時 key 檔案
    fd, key_file = tempfile.mkstemp(prefix=".pai_ssh_", text=True)
    try:
        os.write(fd, ssh_key.encode())
        os.close(fd)
        os.chmod(key_file, 0o600)

        def cleanup():
            try:
                os.unlink(key_file)
            except OSError:
                pass

        atexit.register(cleanup)

        ssh_args = [
            "ssh",
            "-i",
            key_file,
            "-o",
            "StrictHostKeyChecking=no",
            f"pai@{server_ip}",
        ]

        if command:
            ssh_args.append(command)
        else:
            print(f"連線到 pai@{server_ip} ...")
            print("提示: 執行 ~/.local/bin/claude setup-token 設定認證")
            print()

        result = subprocess.run(ssh_args)
        return result.returncode

    finally:
        try:
            os.unlink(key_file)
        except OSError:
            pass


def setup_ssh_config() -> int:
    """
    設定 SSH config（從 vault 提取 key 和 IP）

    Returns:
        0 表示成功
    """
    vault = decrypt_vault()
    ssh_key = extract_ssh_private_key(vault)
    server_ip = vault.get("vault_server_ip")

    if not server_ip:
        print("錯誤：vault 中缺少 vault_server_ip", file=sys.stderr)
        return 1

    # 儲存 SSH key
    SSH_KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    SSH_KEY_FILE.write_text(ssh_key)
    SSH_KEY_FILE.chmod(0o600)
    print(f"SSH key 已儲存到 {SSH_KEY_FILE}")

    # 更新 SSH config
    if SSH_CONFIG.exists():
        config_content = SSH_CONFIG.read_text()
        if "Host pai-server" in config_content:
            print("pai-server 已存在於 SSH config，跳過...")
            return 0
    else:
        config_content = ""

    new_entry = f"""
Host pai-server
    HostName {server_ip}
    User pai
    IdentityFile {SSH_KEY_FILE}
"""

    SSH_CONFIG.write_text(config_content + new_entry)
    print(f"已更新 {SSH_CONFIG}")

    print()
    print("設定完成！測試連線：")
    print("  ssh pai-server")
    print()
    print("啟動 mutagen 同步：")
    print("  ./sync.py start")

    return 0


def main():
    """CLI 入口點"""
    import argparse

    parser = argparse.ArgumentParser(description="SSH 工具")
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # ssh 子命令
    ssh_parser = subparsers.add_parser("connect", help="SSH 連線到 VPS")
    ssh_parser.add_argument("remote_command", nargs="?", help="要執行的遠端命令")

    # setup 子命令
    subparsers.add_parser("setup", help="設定 SSH config")

    args = parser.parse_args()

    if args.command == "connect":
        sys.exit(ssh_to_vps(args.remote_command))
    elif args.command == "setup":
        sys.exit(setup_ssh_config())
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
