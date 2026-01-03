"""路徑和變數定義"""

from pathlib import Path
from typing import Any

# 類型別名
VarDef = dict[str, Any]
FeatureDef = dict[str, Any]
PlaybookDef = dict[str, Any]

# 路徑（對應 ansible.cfg 設定）
ROOT_DIR = Path(__file__).parent.parent
ANSIBLE_DIR = ROOT_DIR / "ansible"
VAULT_DIR = ANSIBLE_DIR / "inventory" / "group_vars" / "all"
VAULT_FILE = VAULT_DIR / "vault.yml"
VAULT_PASSWORD_FILE = Path.home() / ".vault_pass_pai"  # ansible.cfg: vault_password_file
STATE_FILE = ROOT_DIR / ".setup_state.json"

# 必要變數
REQUIRED_VARS: list[VarDef] = [
    {
        "key": "vault_server_ip",
        "prompt": "VPS IP 位址",
        "help": "你的 VPS 公開 IP（例如：123.45.67.89）",
    },
    {
        "key": "pai_agent_user",
        "prompt": "部署用戶名稱",
        "help": "VPS 上的部署用戶名稱",
        "default": "pai",
    },
    {
        "key": "vault_timezone",
        "prompt": "時區",
        "help": "VPS 和排程使用的時區（例如：Asia/Taipei, America/New_York）",
        "default": "Asia/Taipei",
    },
    {
        "key": "vault_local_ssh_key_path",
        "prompt": "本地 SSH Key 路徑",
        "help": "用於初始連接 VPS root 的 SSH 私鑰",
        "default": "~/.ssh/id_ed25519",
    },
    {
        "key": "vault_site_domain",
        "prompt": "網站域名",
        "help": "指向 VPS 的域名（例如：pai.example.com）",
    },
    {
        "key": "telegram_bot_token",
        "prompt": "Telegram Bot Token",
        "help": "從 @BotFather 取得",
        "secret": True,
    },
    {
        "key": "telegram_allowed_user_ids",
        "prompt": "允許的 Telegram User ID",
        "help": "你的 Telegram User ID（從 @userinfobot 取得）",
    },
    {
        "key": "github_token",
        "prompt": "GitHub Token",
        "help": "從 https://github.com/settings/tokens 取得（需要 repo, read:org, gist）",
        "secret": True,
    },
    {
        "key": "github_username",
        "prompt": "GitHub 使用者名稱",
        "help": "你的 GitHub 用戶名",
    },
]

# 可選變數（依功能分組）
OPTIONAL_FEATURES: list[FeatureDef] = [
    {
        "name": "discord",
        "description": "Discord Bot（與 Telegram 同時運行）",
        "vars": [
            {
                "key": "discord_bot_token",
                "prompt": "Discord Bot Token",
                "help": "從 Discord Developer Portal 取得",
                "secret": True,
            },
            {
                "key": "discord_client_id",
                "prompt": "Discord Client ID",
                "help": "從 Discord Developer Portal 取得（用於生成邀請連結）",
            },
            {
                "key": "discord_allowed_user_ids",
                "prompt": "允許的 Discord User ID",
                "help": "你的 Discord User ID（開發者模式下右鍵頭像複製）",
            },
        ],
    },
    {
        "name": "vultr",
        "description": "Vultr 自動建立 VPS",
        "vars": [
            {
                "key": "vultr_api_key",
                "prompt": "Vultr API Key",
                "help": "用於自動建立 VPS",
                "secret": True,
            },
        ],
    },
    {
        "name": "memory",
        "description": "Bot 長期記憶功能",
        "vars": [
            {
                "key": "vault_enable_memory",
                "prompt": "啟用長期記憶",
                "help": "萃取對話中的事實並記憶",
                "type": "bool",
                "default": True,
            },
            {
                "key": "vault_memory_provider",
                "prompt": "記憶萃取模型",
                "help": "gemini（推薦，便宜）或 haiku",
                "default": "gemini",
            },
            {
                "key": "vault_gemini_api_key",
                "prompt": "Gemini API Key",
                "help": "從 https://aistudio.google.com/apikey 取得（用於記憶和轉錄）",
                "secret": True,
            },
        ],
    },
    {
        "name": "transcription",
        "description": "語音轉錄功能（需要 Gemini API Key）",
        "vars": [
            {
                "key": "vault_enable_transcription",
                "prompt": "啟用語音轉錄",
                "help": "使用 Gemini 將語音訊息轉為文字，再送給 Claude 處理",
                "type": "bool",
                "default": True,
            },
        ],
    },
    {
        "name": "fabric",
        "description": "Fabric AI CLI",
        "vars": [
            {
                "key": "vault_enable_fabric",
                "prompt": "啟用 Fabric AI",
                "help": "在 VPS 上安裝 Fabric AI CLI",
                "type": "bool",
                "default": False,
            },
            {
                "key": "vault_anthropic_api_key",
                "prompt": "Anthropic API Key",
                "help": "用於 Fabric AI",
                "secret": True,
            },
        ],
    },
    {
        "name": "google",
        "description": "Google 服務整合（Calendar, Drive, Gmail）",
        "vars": [
            {
                "key": "vault_google_client_id",
                "prompt": "Google OAuth Client ID",
                "help": "從 Google Cloud Console 取得",
            },
            {
                "key": "vault_google_client_secret",
                "prompt": "Google OAuth Client Secret",
                "help": "從 Google Cloud Console 取得",
                "secret": True,
            },
            {
                "key": "vault_google_refresh_token",
                "prompt": "Google OAuth Refresh Token",
                "help": "執行 uv run python -m scripts google auth 取得",
                "secret": True,
            },
        ],
    },
    {
        "name": "mutagen",
        "description": "Mutagen 雙向同步（本地開發用）",
        "vars": [
            {
                "key": "vault_use_mutagen_sync",
                "prompt": "啟用 Mutagen 同步",
                "help": "啟用後 deploy-claude 會跳過 mutagen 同步的目錄",
                "type": "bool",
                "default": True,
            },
        ],
    },
    {
        "name": "garmin",
        "description": "Garmin Connect 健康數據整合（步數、睡眠、心率）",
        "vars": [
            {
                "key": "vault_garmin_email",
                "prompt": "Garmin Connect Email",
                "help": "你的 Garmin Connect 帳號 Email",
            },
            {
                "key": "vault_garmin_password",
                "prompt": "Garmin Connect 密碼",
                "help": "你的 Garmin Connect 密碼",
                "secret": True,
            },
        ],
    },
]

# Playbooks
PLAYBOOKS: list[PlaybookDef] = [
    {
        "name": "init-user",
        "path": "playbooks/init/init-user.yml",
        "description": "建立 VPS 部署用戶（pai）",
        "use_wrapper": False,
    },
    {
        "name": "setup-vps",
        "path": "playbooks/init/setup-vps.yml",
        "description": "安裝 VPS 基礎軟體（Bun, Claude, pm2, gh）",
        "use_wrapper": True,
    },
    {
        "name": "setup-caddy",
        "path": "playbooks/init/setup-caddy.yml",
        "description": "設定 Caddy Web Server（自動 HTTPS）",
        "use_wrapper": True,
    },
    {
        "name": "deploy-bot",
        "path": "playbooks/deploy-bot.yml",
        "description": "部署 Telegram Bot",
        "use_wrapper": True,
    },
    {
        "name": "deploy-claude",
        "path": "playbooks/deploy-claude.yml",
        "description": "部署 Claude 配置",
        "use_wrapper": True,
    },
    {
        "name": "deploy-fabric",
        "path": "playbooks/deploy-fabric.yml",
        "description": "部署 Fabric AI",
        "use_wrapper": True,
        "requires_var": "vault_anthropic_api_key",
        "optional": True,
    },
]
