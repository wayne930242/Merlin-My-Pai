"""YAML 工具"""


def build_vault_yaml(variables: dict) -> str:
    """建立 vault.yml 內容"""
    lines = [
        "# Ansible Vault - 自動產生",
        "# 請勿手動編輯，使用 python -m setup 修改",
        "",
    ]

    sections = [
        ("Telegram Bot", ["telegram_bot_token", "telegram_allowed_user_ids"]),
        ("VPS 設定", ["vault_server_ip", "pai_agent_user"]),
        ("本地 SSH Key", ["vault_local_ssh_key_path"]),
        ("網站設定", ["vault_site_domain"]),
        ("SSH Key（部署用）", ["pai_agent_ssh_private_key", "pai_agent_ssh_public_key"]),
        ("GitHub", ["github_token", "github_username"]),
        ("Vultr API（可選）", ["vultr_api_key"]),
        ("Anthropic API（可選）", ["vault_anthropic_api_key"]),
        ("Google OAuth（可選）", [
            "vault_google_client_id",
            "vault_google_client_secret",
            "vault_google_refresh_token",
        ]),
    ]

    for section_name, keys in sections:
        section_vars: list[tuple[str, str]] = [
            (k, v) for k in keys if (v := variables.get(k)) is not None
        ]
        if not section_vars:
            continue

        lines.append(f"# === {section_name} ===")
        for key, value in section_vars:
            if "\n" in value:  # 多行值（SSH Key）
                lines.append(f"{key}: |")
                for line in value.strip().split("\n"):
                    lines.append(f"  {line}")
            else:
                # 對於包含特殊字元的值，使用雙引號
                special_chars = (
                    '"', "'", ":", "#", "{", "}", "[", "]",
                    ",", "&", "*", "!", "|", ">", "%", "@", "`"
                )
                if any(c in value for c in special_chars):
                    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
                    lines.append(f'{key}: "{escaped}"')
                else:
                    lines.append(f"{key}: {value}")
        lines.append("")

    return "\n".join(lines)
