#!/usr/bin/env python3
"""
PAI Infrastructure Scripts
用法: uv run python -m scripts <command> [args...]
"""

import sys


def main():
    if len(sys.argv) < 2:
        print_help()
        sys.exit(1)

    command = sys.argv[1]
    args = sys.argv[2:]

    if command in ("help", "-h", "--help"):
        print_help()
    elif command == "ansible":
        if not args:
            print("用法: uv run pai ansible <ansible-command> [args...]")
            print("範例: uv run pai ansible ansible-playbook ansible/playbooks/deploy-bot.yml")
            sys.exit(1)
        from .ansible import run_ansible

        sys.exit(run_ansible(args))
    elif command == "ssh":
        run_ssh_command(args)
    elif command == "google":
        run_google_command(args)
    else:
        print(f"未知命令: {command}")
        print()
        print_help()
        sys.exit(1)


def run_ssh_command(args: list[str]):
    from .ssh import setup_ssh_config, ssh_to_vps

    if not args:
        print("用法: uv run pai ssh <subcommand>")
        print("  connect [command]  SSH 連線到 VPS")
        print("  setup              設定 SSH config")
        sys.exit(1)

    subcommand = args[0]
    if subcommand == "connect":
        remote_cmd = args[1] if len(args) > 1 else None
        sys.exit(ssh_to_vps(remote_cmd))
    elif subcommand == "setup":
        sys.exit(setup_ssh_config())
    else:
        print(f"未知子命令: {subcommand}")
        sys.exit(1)


def run_google_command(args: list[str]):
    from .google import do_auth, do_token

    if not args:
        print("用法: uv run pai google <subcommand>")
        print("  auth   執行 OAuth2 授權流程")
        print("  token  取得 access token")
        sys.exit(1)

    subcommand = args[0]
    if subcommand == "auth":
        sys.exit(do_auth())
    elif subcommand == "token":
        sys.exit(do_token())
    else:
        print(f"未知子命令: {subcommand}")
        sys.exit(1)


def print_help():
    print("PAI Infrastructure Scripts")
    print()
    print("用法: uv run pai <command> [args...]")
    print()
    print("Commands:")
    print("  ansible <args...>     執行 ansible 命令（自動解密 SSH key）")
    print("  ssh connect [cmd]     SSH 連線到 VPS")
    print("  ssh setup             設定 SSH config")
    print("  google auth           執行 Google OAuth2 授權")
    print("  google token          取得 Google access token")
    print()
    print("範例:")
    print("  uv run pai ansible ansible-playbook ansible/playbooks/deploy-bot.yml")
    print("  uv run pai ssh connect")
    print("  uv run pai google auth")


if __name__ == "__main__":
    main()
