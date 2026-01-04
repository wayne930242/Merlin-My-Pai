#!/usr/bin/env python3
"""Mutagen 同步工具 - 跨平台版本"""

import subprocess
import sys
import time
from pathlib import Path

import yaml

PROJECT_DIR = Path(__file__).parent.resolve()
LOCAL_CONFIG_FILE = PROJECT_DIR / "local.yml"


def load_local_config() -> dict | None:
    """讀取個人同步設定"""
    if not LOCAL_CONFIG_FILE.exists():
        return None
    with LOCAL_CONFIG_FILE.open() as f:
        return yaml.safe_load(f)


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
            print("請從 https://mutagen.io/documentation/introduction/installation 下載安裝")
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


def generate_obsidian_index(vault_path: str) -> None:
    """產生 Obsidian vault 的索引檔"""
    from scripts.obsidian_index import generate_index

    try:
        print(f"產生 Obsidian 索引: {vault_path}")
        generate_index(vault_path)
    except Exception as e:
        print(f"警告: 無法產生索引: {e}")


def start_obsidian_sync(config: dict) -> None:
    """啟動 Obsidian vault 同步"""
    sync_config = config.get("sync", {})
    obs_config = sync_config.get("obsidian")
    if not obs_config:
        return

    local_path = obs_config.get("local_path")
    if not local_path:
        print("警告: obsidian.local_path 未設定，跳過 Obsidian 同步")
        return

    # 展開 ~
    local_path = str(Path(local_path).expanduser())
    if not Path(local_path).exists():
        print(f"警告: Obsidian vault 不存在: {local_path}")
        return

    # 產生索引
    generate_obsidian_index(local_path)

    remote_path = obs_config.get("remote_path", "~/obsidian")
    mode = obs_config.get("mode", "one-way-replica")

    print(f"啟動 Obsidian 同步: {local_path} → pai-server:{remote_path}")

    # 先終止舊的 session（如果存在）
    run_cmd(["mutagen", "sync", "terminate", "obsidian"], check=False, capture=True)

    # 建立新的 sync session
    run_cmd(
        [
            "mutagen",
            "sync",
            "create",
            "--name",
            "obsidian",
            "--mode",
            mode,
            "--ignore-vcs",
            local_path,
            f"pai-server:{remote_path}",
        ]
    )


def stop_obsidian_sync() -> None:
    """停止 Obsidian vault 同步"""
    result = run_cmd(
        ["mutagen", "sync", "terminate", "obsidian"],
        check=False,
        capture=True,
    )
    if result.returncode == 0:
        print("已停止 Obsidian 同步")


def do_start():
    """啟動同步"""
    print("啟動 mutagen daemon...")
    run_cmd(["mutagen", "daemon", "start"], check=False)
    print("啟動同步...")
    run_cmd(["mutagen", "project", "start"])

    # 啟動個人同步
    config = load_local_config()
    if config:
        print()
        start_obsidian_sync(config)

    print()
    run_cmd(["mutagen", "sync", "list"])


def do_stop():
    """停止同步"""
    stop_obsidian_sync()
    print("停止同步...")
    run_cmd(["mutagen", "project", "terminate"])


def do_status():
    """查看狀態"""
    run_cmd(["mutagen", "sync", "list"])


def do_flush():
    """強制同步"""
    print("強制同步...")
    run_cmd(["mutagen", "sync", "flush", "pai-claude"])

    # 也 flush obsidian（如果存在）
    run_cmd(["mutagen", "sync", "flush", "obsidian"], check=False, capture=True)

    time.sleep(2)
    run_cmd(["mutagen", "sync", "list"])


def do_reset():
    """重置 session"""
    print("重置同步 session...")
    stop_obsidian_sync()
    run_cmd(["mutagen", "project", "terminate"], check=False)
    run_cmd(["mutagen", "project", "start"])

    # 重新啟動個人同步
    config = load_local_config()
    if config:
        start_obsidian_sync(config)


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
