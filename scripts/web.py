"""
Web Development Server Manager

用法:
  uv run pai web dev       同時啟動 pai-bot + pai-web 開發伺服器
  uv run pai web bot       只啟動 pai-bot API 伺服器
  uv run pai web frontend  只啟動 pai-web 前端伺服器
"""

import os
import signal
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent


def run_both() -> int:
    """同時啟動後端和前端"""
    bot_dir = PROJECT_ROOT / "pai-bot"
    web_dir = PROJECT_ROOT / "pai-web"

    if not bot_dir.exists():
        print(f"錯誤: 找不到 {bot_dir}")
        return 1

    if not web_dir.exists():
        print(f"錯誤: 找不到 {web_dir}")
        return 1

    print("啟動開發伺服器...")
    print("  pai-bot: http://localhost:3000")
    print("  pai-web: http://localhost:5173")
    print()
    print("按 Ctrl+C 停止所有伺服器")
    print()

    # 啟動兩個進程
    bot_proc = subprocess.Popen(
        ["bun", "run", "dev"],
        cwd=bot_dir,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )

    web_proc = subprocess.Popen(
        ["bun", "run", "dev"],
        cwd=web_dir,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )

    def cleanup(signum: int, frame: object) -> None:
        print("\n停止伺服器...")
        bot_proc.terminate()
        web_proc.terminate()
        bot_proc.wait()
        web_proc.wait()
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    # 等待任一進程結束
    while True:
        bot_code = bot_proc.poll()
        web_code = web_proc.poll()

        if bot_code is not None:
            print(f"pai-bot 已停止 (exit {bot_code})")
            web_proc.terminate()
            return bot_code

        if web_code is not None:
            print(f"pai-web 已停止 (exit {web_code})")
            bot_proc.terminate()
            return web_code

        try:
            bot_proc.wait(timeout=0.5)
        except subprocess.TimeoutExpired:
            pass


def run_bot() -> int:
    """只啟動後端"""
    bot_dir = PROJECT_ROOT / "pai-bot"

    if not bot_dir.exists():
        print(f"錯誤: 找不到 {bot_dir}")
        return 1

    print("啟動 pai-bot...")
    print("  API: http://localhost:3000")
    print("  WebSocket: ws://localhost:3000/ws")
    print()

    os.chdir(bot_dir)
    os.execvp("bun", ["bun", "run", "dev"])
    return 0


def run_frontend() -> int:
    """只啟動前端"""
    web_dir = PROJECT_ROOT / "pai-web"

    if not web_dir.exists():
        print(f"錯誤: 找不到 {web_dir}")
        return 1

    print("啟動 pai-web...")
    print("  Frontend: http://localhost:5173")
    print()

    os.chdir(web_dir)
    os.execvp("bun", ["bun", "run", "dev"])
    return 0
