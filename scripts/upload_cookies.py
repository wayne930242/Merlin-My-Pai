#!/usr/bin/env python3
"""上傳 YouTube cookies 到 VPS"""

import subprocess
import sys
from pathlib import Path


def main() -> None:
    # 取得 cookie 檔案路徑
    cookie_path = input("Cookie 檔案路徑: ").strip()

    # 展開 ~ 並轉換為 Path
    cookie_file = Path(cookie_path).expanduser()

    if not cookie_file.exists():
        print(f"❌ 檔案不存在: {cookie_file}")
        sys.exit(1)

    # 讀取並上傳
    print(f"📤 上傳 {cookie_file} 到 VPS...")

    with open(cookie_file) as f:
        content = f.read()

    result = subprocess.run(
        ["uv", "run", "pai", "ssh", "connect", "cat > /home/pai/youtube-cookies.txt"],
        input=content,
        text=True,
        capture_output=True,
    )

    if result.returncode != 0:
        print(f"❌ 上傳失敗: {result.stderr}")
        sys.exit(1)

    # 驗證
    verify = subprocess.run(
        ["uv", "run", "pai", "ssh", "connect", "wc -l /home/pai/youtube-cookies.txt"],
        capture_output=True,
        text=True,
    )

    print(f"✅ 上傳成功！{verify.stdout.strip()}")


if __name__ == "__main__":
    main()
