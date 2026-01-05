#!/usr/bin/env python3
"""
PAI Infrastructure Scripts
用法: uv run python -m scripts <command> [args...]
"""

import sys


def main() -> None:
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
    elif command == "bot":
        run_bot_command(args)
    elif command == "google":
        run_google_command(args)
    elif command == "discord":
        run_discord_command(args)
    elif command == "spotify":
        run_spotify_command(args)
    elif command == "git":
        run_git_command(args)
    elif command == "web":
        run_web_command(args)
    else:
        print(f"未知命令: {command}")
        print()
        print_help()
        sys.exit(1)


def run_ssh_command(args: list[str]) -> None:
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


def run_bot_command(args: list[str]) -> None:
    from .bot import logs, restart, status

    if not args:
        print("用法: uv run pai bot <subcommand>")
        print("  status           查看 bot 狀態")
        print("  logs [-n NUM]    查看日誌（預設 50 行）")
        print("  logs -f          持續追蹤日誌")
        print("  logs -e          查看錯誤日誌")
        print("  restart          重啟 bot")
        sys.exit(1)

    subcommand = args[0]
    if subcommand == "status":
        sys.exit(status())
    elif subcommand == "logs":
        follow = "-f" in args
        error = "-e" in args
        lines = 50
        if "-n" in args:
            try:
                idx = args.index("-n")
                lines = int(args[idx + 1])
            except (IndexError, ValueError):
                pass
        sys.exit(logs(lines=lines, follow=follow, error=error))
    elif subcommand == "restart":
        sys.exit(restart())
    else:
        print(f"未知子命令: {subcommand}")
        sys.exit(1)


def run_google_command(args: list[str]) -> None:
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


def run_discord_command(args: list[str]) -> None:
    from .discord import invite

    if not args:
        print("用法: uv run pai discord <subcommand>")
        print("  invite   生成 Bot 邀請連結")
        sys.exit(1)

    subcommand = args[0]
    if subcommand == "invite":
        sys.exit(invite())
    else:
        print(f"未知子命令: {subcommand}")
        sys.exit(1)


def run_spotify_command(args: list[str]) -> None:
    from .spotify import do_auth, do_run, do_test

    if not args:
        print("用法: uv run pai spotify <subcommand>")
        print("  auth   執行 Spotify OAuth 認證（首次使用需要）")
        print("  test   測試 librespot 和認證狀態")
        print("  run    手動啟動 librespot（測試用）")
        sys.exit(1)

    subcommand = args[0]
    if subcommand == "auth":
        sys.exit(do_auth())
    elif subcommand == "test":
        sys.exit(do_test())
    elif subcommand == "run":
        sys.exit(do_run())
    else:
        print(f"未知子命令: {subcommand}")
        sys.exit(1)


def run_web_command(args: list[str]) -> None:
    from .web import run_bot, run_both, run_frontend

    if not args:
        print("用法: uv run pai web <subcommand>")
        print("  dev       同時啟動 pai-bot + pai-web 開發伺服器")
        print("  bot       只啟動 pai-bot API 伺服器")
        print("  frontend  只啟動 pai-web 前端伺服器")
        sys.exit(1)

    subcommand = args[0]
    if subcommand == "dev":
        sys.exit(run_both())
    elif subcommand == "bot":
        sys.exit(run_bot())
    elif subcommand == "frontend":
        sys.exit(run_frontend())
    else:
        print(f"未知子命令: {subcommand}")
        sys.exit(1)


def run_git_command(args: list[str]) -> None:
    from .git import commit_with_restore, list_skipped, track, untrack

    if not args:
        print("用法: uv run pai git <subcommand>")
        print("  skip list          列出被 skip-worktree 忽略的檔案")
        print("  skip track <file>  暫時恢復追蹤")
        print("  skip untrack <file>  重新設定 skip-worktree")
        print("  skip commit        互動式選擇檔案並 commit")
        sys.exit(1)

    subcommand = args[0]
    if subcommand == "skip":
        if len(args) < 2:
            print("用法: uv run pai git skip <list|track|untrack|commit>")
            sys.exit(1)
        action = args[1]
        if action == "list":
            sys.exit(list_skipped())
        elif action == "track":
            if len(args) < 3:
                print("用法: uv run pai git skip track <file>")
                sys.exit(1)
            sys.exit(track(args[2]))
        elif action == "untrack":
            if len(args) < 3:
                print("用法: uv run pai git skip untrack <file>")
                sys.exit(1)
            sys.exit(untrack(args[2]))
        elif action == "commit":
            sys.exit(commit_with_restore())
        else:
            print(f"未知動作: {action}")
            sys.exit(1)
    else:
        print(f"未知子命令: {subcommand}")
        sys.exit(1)


def print_help() -> None:
    print("PAI Infrastructure Scripts")
    print()
    print("用法: uv run pai <command> [args...]")
    print()
    print("Commands:")
    print("  ansible <args...>     執行 ansible 命令（自動解密 SSH key）")
    print("  ssh connect [cmd]     SSH 連線到 VPS")
    print("  ssh setup             設定 SSH config")
    print("  bot status            查看 bot 狀態")
    print("  bot logs [-n N] [-f]  查看 bot 日誌")
    print("  bot restart           重啟 bot")
    print("  google auth           執行 Google OAuth2 授權")
    print("  google token          取得 Google access token")
    print("  discord invite        生成 Discord Bot 邀請連結")
    print("  spotify auth          執行 Spotify 認證")
    print("  spotify test          測試 Spotify 認證狀態")
    print("  git skip list         列出被忽略的檔案")
    print("  git skip commit       互動式 commit 被忽略的檔案")
    print("  web dev               同時啟動 pai-bot + pai-web 開發伺服器")
    print("  web bot               只啟動 pai-bot API 伺服器")
    print("  web frontend          只啟動 pai-web 前端伺服器")
    print()
    print("範例:")
    print("  uv run pai ansible ansible-playbook ansible/playbooks/deploy-bot.yml")
    print("  uv run pai ssh connect")
    print("  uv run pai bot status")
    print("  uv run pai google auth")
    print("  uv run pai web dev")


if __name__ == "__main__":
    main()
