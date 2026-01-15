"""Vault 設定"""

from getpass import getpass

from .. import ui
from ..config import ROOT_DIR, VAULT_DIR, VAULT_FILE, VAULT_PASSWORD_FILE
from ..state import SetupState
from ..utils import build_vault_yaml, run_command


def setup_vault_password(state: SetupState) -> bool:
    """設定 Vault 密碼"""
    ui.step(1, 4, "設定 Vault 密碼")

    if state.vault_password_set and VAULT_PASSWORD_FILE.exists():
        ui.success("Vault 密碼已設定")
        if not ui.ask_yes_no("是否要重新設定密碼？", default=False):
            return True

    print("請設定 Ansible Vault 密碼（用於加密敏感資料）")
    print("提示：請記住這個密碼，之後解密需要使用")

    while True:
        password = getpass("輸入新密碼: ").strip()
        if len(password) < 8:
            print("密碼至少需要 8 個字元")
            continue
        confirm = getpass("確認密碼: ").strip()
        if password != confirm:
            print("密碼不符，請重試")
            continue
        break

    VAULT_PASSWORD_FILE.write_text(password)
    VAULT_PASSWORD_FILE.chmod(0o600)
    ui.success("Vault 密碼已儲存")

    state.vault_password_set = True
    state.save()
    return True


def create_vault_file(state: SetupState) -> bool:
    """建立並加密 vault.yml"""
    ui.step(4, 4, "建立 Vault 檔案")

    content = build_vault_yaml(state.variables)

    # 如果已加密，先解密
    if state.vault_encrypted and VAULT_FILE.exists():
        result = run_command(
            [
                "ansible-vault",
                "decrypt",
                str(VAULT_FILE),
                "--vault-password-file",
                str(VAULT_PASSWORD_FILE),
            ],
            cwd=ROOT_DIR,
        )
        if result and result.returncode == 0:
            state.vault_encrypted = False

    # 寫入檔案
    VAULT_DIR.mkdir(parents=True, exist_ok=True)
    VAULT_FILE.write_text(content)
    VAULT_FILE.chmod(0o600)
    ui.success("vault.yml 已建立")

    state.vault_created = True
    state.save()

    # 加密
    print("\n加密 vault.yml...")
    result = run_command(
        [
            "ansible-vault",
            "encrypt",
            str(VAULT_FILE),
            "--vault-password-file",
            str(VAULT_PASSWORD_FILE),
            "--encrypt-vault-id",
            "default",
        ],
        cwd=ROOT_DIR,
    )

    if not result or result.returncode != 0:
        ui.error("加密失敗")
        return False

    ui.success("vault.yml 已加密")
    state.vault_encrypted = True
    state.save()
    return True
