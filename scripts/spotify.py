"""Spotify/Librespot tools"""

import sys
from io import StringIO
from contextlib import redirect_stdout, redirect_stderr

from .ssh import ssh_to_vps

LIBRESPOT_PATH = "/home/pai/.cargo/bin/librespot"
CACHE_DIR = "/home/pai/.cache/librespot"
CREDENTIALS_FILE = f"{CACHE_DIR}/credentials.json"
DEVICE_NAME = "Merlin DJ"


def _check_credentials() -> bool:
    """Check if credentials exist on VPS (silent)"""
    # Suppress output
    old_stdout, old_stderr = sys.stdout, sys.stderr
    sys.stdout = StringIO()
    sys.stderr = StringIO()
    try:
        result = ssh_to_vps(f"test -f {CREDENTIALS_FILE}")
        return result == 0
    finally:
        sys.stdout, sys.stderr = old_stdout, old_stderr


def do_auth() -> int:
    """OAuth authentication for librespot (headless mode)"""
    print("=" * 50)
    print("  Spotify OAuth 認證 (Headless Mode)")
    print("=" * 50)
    print()

    # Check if already authenticated
    if _check_credentials():
        print("⚠️  已有 credentials，重新認證將覆蓋現有資料")
        print()

    print("步驟：")
    print("  1. 等待出現 'Browse to: https://...' 的 URL")
    print("  2. 在瀏覽器開啟這個 URL 並授權")
    print("  3. 授權後會跳轉到失敗頁面 (無法連線)")
    print("  4. 複製瀏覽器網址列的完整 URL (http://127.0.0.1/login?code=...)")
    print("  5. 貼回這裡按 Enter")
    print()
    print("提示：看到 'Provide redirect URL' 後貼上 URL")
    print()
    print("-" * 50)

    # Run librespot OAuth (使用 pipe backend 避免 ALSA 錯誤)
    exit_code = ssh_to_vps(
        f"{LIBRESPOT_PATH} "
        f"--name '{DEVICE_NAME}' "
        f"--cache {CACHE_DIR} "
        "--backend pipe "
        "--enable-oauth "
        "--oauth-port 0"
    )

    print()
    print("-" * 50)

    # Verify credentials were created
    if _check_credentials():
        print()
        print("=" * 50)
        print("  ✓ 認證成功！Credentials 已儲存")
        print("=" * 50)
        print()
        print(f"  帳號資料位置: {CREDENTIALS_FILE}")
        print("  現在可以使用 Discord /spotify 命令了")
        print()
        return 0
    else:
        print()
        print("=" * 50)
        print("  ✗ 認證失敗，未找到 credentials")
        print("=" * 50)
        print()
        print("  請檢查上方的錯誤訊息")
        print()
        return exit_code if exit_code != 0 else 1


def do_test() -> int:
    """Test librespot installation and credentials"""
    print("=" * 50)
    print("  Spotify / Librespot 狀態檢查")
    print("=" * 50)
    print()

    # Check version
    print("📦 Librespot 版本:")
    print("  ", end="", flush=True)
    ssh_to_vps(f"{LIBRESPOT_PATH} --version")

    # Check credentials
    print()
    print("🔑 Credentials 狀態:")
    if _check_credentials():
        print("  ✓ credentials.json 存在")
    else:
        print("  ✗ 未找到 credentials")
        print("  → 請執行: uv run pai spotify auth")
    print()

    return 0


def do_run() -> int:
    """Run librespot manually for testing"""
    print("=" * 50)
    print("  手動啟動 Librespot (測試用)")
    print("=" * 50)
    print()

    if not _check_credentials():
        print("✗ 未找到 credentials，請先執行:")
        print("  uv run pai spotify auth")
        return 1

    print("按 Ctrl+C 停止")
    print("-" * 50)

    return ssh_to_vps(
        f"{LIBRESPOT_PATH} "
        f"--name '{DEVICE_NAME}' "
        f"--cache {CACHE_DIR} "
        "--backend pipe "
        "--initial-volume 100 "
        "--bitrate 320 "
        "--verbose"
    )
