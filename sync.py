#!/usr/bin/env python3
"""Mutagen 同步工具 - 跨平台版本"""

import subprocess
import sys
import time
from pathlib import Path

PROJECT_DIR = Path(__file__).parent.resolve()


def run_cmd(
    cmd: list[str], check: bool = True, capture: bool = False
) -> subprocess.CompletedProcess[str]:
    """執行命令"""
    return subprocess.run(
        cmd,
        check=check,
        capture_output=capture,
        text=True,
        cwd=PROJECT_DIR,
    )


def check_mutagen() -> bool:
    """檢查 mutagen 是否安裝"""
    result = run_cmd(["mutagen", "version"], check=False, capture=True)
    if result.returncode != 0:
        print("錯誤: mutagen 未安裝")
        if sys.platform == "darwin":
            print("請執行: brew install mutagen-io/mutagen/mutagen")
        elif sys.platform == "win32":
            print(
                "請從 https://mutagen.io/documentation/introduction/installation 下載安裝"
            )
        else:
            print("請參考: https://mutagen.io/documentation/introduction/installation")
        return False
    return True


def check_ssh_config() -> bool:
    """檢查 SSH config 是否設定"""
    ssh_config = Path.home() / ".ssh" / "config"
    if not ssh_config.exists():
        print("錯誤: SSH config 不存在")
        print("請先執行: cd ansible && ./scripts/setup-ssh-config.sh")
        return False

    config_content = ssh_config.read_text()
    if "Host pai-server" not in config_content:
        print("錯誤: SSH config 未設定 pai-server")
        print("請先執行: cd ansible && ./scripts/setup-ssh-config.sh")
        return False
    return True


def do_start():
    """啟動同步"""
    print("啟動 mutagen daemon...")
    run_cmd(["mutagen", "daemon", "start"], check=False)
    print("啟動同步...")
    run_cmd(["mutagen", "project", "start"])
    print()
    run_cmd(["mutagen", "sync", "list"])


def do_stop():
    """停止同步"""
    print("停止同步...")
    run_cmd(["mutagen", "project", "terminate"])


def do_status():
    """查看狀態"""
    run_cmd(["mutagen", "sync", "list"])


def do_flush():
    """強制同步"""
    print("強制同步...")
    run_cmd(["mutagen", "sync", "flush", "pai-claude"])
    time.sleep(2)
    run_cmd(["mutagen", "sync", "list"])


def do_reset():
    """重置 session"""
    print("重置同步 session...")
    run_cmd(["mutagen", "project", "terminate"], check=False)
    run_cmd(["mutagen", "project", "start"])


def show_help():
    """顯示說明"""
    print("Mutagen 同步工具")
    print()
    print("用法: ./sync.py [command]")
    print()
    print("Commands:")
    print("  start   啟動同步")
    print("  stop    停止同步")
    print("  status  查看狀態")
    print("  flush   強制同步")
    print("  reset   重置 session")
    print("  help    顯示此說明")
    print()
    print("無參數時進入互動模式")


def interactive_menu():
    """互動選單"""
    print("╭─────────────────────────────╮")
    print("│   Mutagen 同步工具         │")
    print("╰─────────────────────────────╯")
    print()

    options = [
        ("1", "啟動同步", do_start),
        ("2", "停止同步", do_stop),
        ("3", "查看狀態", do_status),
        ("4", "強制同步", do_flush),
        ("5", "重置 session", do_reset),
        ("6", "離開", None),
    ]

    for key, label, _ in options:
        print(f"  {key}) {label}")
    print()

    while True:
        try:
            choice = input("請選擇操作 [1-6]: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye!")
            sys.exit(0)

        for key, _, action in options:
            if choice == key:
                if action is None:
                    print("Bye!")
                    sys.exit(0)
                action()
                return

        print("無效選項，請輸入 1-6")


def main():
    if not check_mutagen():
        sys.exit(1)
    if not check_ssh_config():
        sys.exit(1)

    commands = {
        "start": do_start,
        "stop": do_stop,
        "status": do_status,
        "flush": do_flush,
        "reset": do_reset,
        "help": show_help,
        "-h": show_help,
        "--help": show_help,
    }

    if len(sys.argv) < 2:
        interactive_menu()
    elif sys.argv[1] in commands:
        commands[sys.argv[1]]()
    else:
        print(f"未知指令: {sys.argv[1]}")
        print()
        show_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
