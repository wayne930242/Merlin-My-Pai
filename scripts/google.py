"""Google OAuth2 工具"""

import http.server
import subprocess
import sys
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path
from typing import Any

import yaml

from .vault import ROOT_DIR, VAULT_FILE, VAULT_PASSWORD_FILE, decrypt_vault

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/contacts",
]
REDIRECT_URI = "http://localhost:8085"


class OAuthCallbackHandler(http.server.BaseHTTPRequestHandler):
    """處理 OAuth callback 的 HTTP handler"""

    auth_code: str | None = None

    def do_GET(self):
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)

        if "code" in params:
            OAuthCallbackHandler.auth_code = params["code"][0]
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write("授權成功！可以關閉此視窗。".encode())
        else:
            self.send_response(400)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write("授權失敗。".encode())

    def log_message(self, format: str, *args: Any) -> None:
        pass  # 靜默


def wait_for_callback() -> str | None:
    """啟動本機伺服器等待 OAuth callback"""
    server = http.server.HTTPServer(("localhost", 8085), OAuthCallbackHandler)
    server.timeout = 120  # 2 分鐘超時
    server.handle_request()
    return OAuthCallbackHandler.auth_code


def exchange_code_for_tokens(
    client_id: str, client_secret: str, auth_code: str
) -> dict:
    """用 authorization code 交換 tokens"""
    data = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": auth_code,
            "grant_type": "authorization_code",
            "redirect_uri": REDIRECT_URI,
        }
    ).encode()

    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    import json

    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())


def refresh_access_token(
    client_id: str, client_secret: str, refresh_token: str
) -> str:
    """用 refresh token 取得新的 access token"""
    data = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
    ).encode()

    req = urllib.request.Request(
        "https://oauth2.googleapis.com/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    import json

    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode())
        return result["access_token"]


def update_vault_refresh_token(refresh_token: str) -> None:
    """更新 vault 中的 refresh token"""
    # 解密 vault
    tmp_file = Path("/tmp/vault_decrypted_google")

    subprocess.run(
        [
            "ansible-vault",
            "decrypt",
            str(VAULT_FILE),
            "--vault-password-file",
            str(VAULT_PASSWORD_FILE),
            f"--output={tmp_file}",
        ],
        check=True,
        cwd=ROOT_DIR,
    )

    # 讀取並更新
    content = yaml.safe_load(tmp_file.read_text())
    content["vault_google_refresh_token"] = refresh_token

    tmp_file.write_text(yaml.dump(content, default_flow_style=False, allow_unicode=True))

    # 重新加密
    subprocess.run(
        [
            "ansible-vault",
            "encrypt",
            str(tmp_file),
            "--vault-password-file",
            str(VAULT_PASSWORD_FILE),
            f"--output={VAULT_FILE}",
        ],
        check=True,
        cwd=ROOT_DIR,
    )

    tmp_file.unlink()


def do_auth() -> int:
    """執行 Google OAuth2 授權流程"""
    print("=== Google OAuth2 授權 ===")
    print()

    vault = decrypt_vault()
    client_id = vault.get("vault_google_client_id")
    client_secret = vault.get("vault_google_client_secret")

    if not client_id or not client_secret:
        print("錯誤：vault 中缺少 Google OAuth2 credentials", file=sys.stderr)
        print("請先在 vault 中設定：", file=sys.stderr)
        print("  vault_google_client_id", file=sys.stderr)
        print("  vault_google_client_secret", file=sys.stderr)
        return 1

    print(f"Client ID: {client_id[:20]}...")

    # 產生授權 URL
    scope_str = " ".join(SCOPES)
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={client_id}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={urllib.parse.quote(scope_str)}"
        f"&access_type=offline"
        f"&prompt=consent"
    )

    print("請在瀏覽器中開啟以下網址進行授權：")
    print()
    print(auth_url)
    print()

    # 嘗試自動開啟瀏覽器
    webbrowser.open(auth_url)

    # 等待 callback
    print("等待授權回調...")
    auth_code = wait_for_callback()

    if not auth_code:
        print("錯誤：未收到授權回調", file=sys.stderr)
        return 1

    print("取得 authorization code，交換 tokens...")

    # 交換 tokens
    tokens = exchange_code_for_tokens(client_id, client_secret, auth_code)
    refresh_token = tokens.get("refresh_token")

    if not refresh_token:
        print("錯誤：未取得 refresh token", file=sys.stderr)
        print(f"回應：{tokens}", file=sys.stderr)
        return 1

    print()
    print("=== 成功取得 Refresh Token ===")
    print()

    # 更新 vault
    print("更新 vault...")
    update_vault_refresh_token(refresh_token)

    print()
    print("✓ Refresh token 已存入 vault")
    return 0


def do_token() -> int:
    """取得 access token"""
    vault = decrypt_vault()
    client_id = vault.get("vault_google_client_id")
    client_secret = vault.get("vault_google_client_secret")
    refresh_token = vault.get("vault_google_refresh_token")

    if not client_id or not client_secret or not refresh_token:
        print("錯誤：vault 中缺少 Google OAuth2 設定", file=sys.stderr)
        print("請先執行: uv run python -m scripts.google auth", file=sys.stderr)
        return 1

    try:
        access_token = refresh_access_token(client_id, client_secret, refresh_token)
        print(access_token)
        return 0
    except Exception as e:
        print(f"錯誤：無法取得 access token: {e}", file=sys.stderr)
        return 1


def main():
    """CLI 入口點"""
    import argparse

    parser = argparse.ArgumentParser(description="Google OAuth2 工具")
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    subparsers.add_parser("auth", help="執行 OAuth2 授權流程")
    subparsers.add_parser("token", help="取得 access token")

    args = parser.parse_args()

    if args.command == "auth":
        sys.exit(do_auth())
    elif args.command == "token":
        sys.exit(do_token())
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
