"""變數收集"""

import secrets
from typing import Any

from .. import ui
from ..config import OPTIONAL_FEATURES, REQUIRED_VARS
from ..state import SetupState
from ..utils import generate_ssh_key, validate_ssh_private_key_path


def generate_api_key() -> str:
    """產生隨機 API Key（64 字元 hex）"""
    return secrets.token_hex(32)


def collect_required_vars(state: SetupState) -> bool:
    """收集必要變數"""
    ui.step(2, 4, "設定必要變數")

    variables: dict[str, Any] = state.variables

    for var in REQUIRED_VARS:
        key: str = var["key"]
        current: str | None = variables.get(key)

        if current:
            display = "********" if var.get("secret") else current
            print(f"\n{var['prompt']}: {display}")
            if not ui.ask_yes_no("保留此設定？"):
                current = None

        if not current:
            ui.show_var(var)

            # 對 SSH key 路徑進行驗證
            if key == "vault_local_ssh_key_path":
                max_attempts = 3
                for attempt in range(max_attempts):
                    value = ui.get_input(
                        "  輸入值", var.get("default"), var.get("secret", False)
                    )
                    if not value and not var.get("default"):
                        ui.error("此為必要欄位")
                        return False

                    # 驗證 SSH key 路徑
                    is_valid, message = validate_ssh_private_key_path(value)
                    if is_valid:
                        # 儲存展開後的絕對路徑，避免 Ansible 執行時的歧義
                        from pathlib import Path

                        expanded = Path(value).expanduser().resolve()
                        variables[key] = str(expanded)
                        print(f"  {message}")
                        break
                    else:
                        # 顯示錯誤訊息並詢問是否重新輸入
                        print(f"\n{message}\n")
                        remaining = max_attempts - attempt - 1
                        if remaining > 0:
                            if not ui.ask_yes_no(
                                f"重新輸入？（剩餘 {remaining} 次機會）", default=True
                            ):
                                return False
                        else:
                            ui.error("已達到最大嘗試次數 (3 次)")
                            return False
            else:
                # 其他變數直接收集
                value = ui.get_input("  輸入值", var.get("default"), var.get("secret", False))
                if not value and not var.get("default"):
                    ui.error("此為必要欄位")
                    return False
                variables[key] = value

    # 產生 SSH Key
    if "pai_agent_ssh_private_key" in variables and state.ssh_key_generated:
        ui.success("SSH Key 已產生")
        if ui.ask_yes_no("是否要重新產生？", default=False):
            del variables["pai_agent_ssh_private_key"]
            del variables["pai_agent_ssh_public_key"]
            state.ssh_key_generated = False

    if "pai_agent_ssh_private_key" not in variables:
        print("\n需要產生用於 Ansible 部署的 SSH Key")
        private_key, public_key = generate_ssh_key()
        if not private_key:
            ui.error("SSH Key 產生失敗")
            return False
        variables["pai_agent_ssh_private_key"] = private_key
        variables["pai_agent_ssh_public_key"] = public_key
        state.ssh_key_generated = True
        ui.success("SSH Key 已產生")

    state.variables = variables
    state.save()
    return True


def collect_optional_vars(state: SetupState) -> bool:
    """收集可選變數"""
    ui.step(3, 4, "設定可選功能")

    variables: dict[str, Any] = state.variables

    for feature in OPTIONAL_FEATURES:
        desc: str = feature["description"]
        feature_vars: list[dict[str, Any]] = feature["vars"]

        # 檢查是否已設定（bool 類型 False 也算設定）
        all_set = all(v["key"] in variables for v in feature_vars)

        if all_set:
            print(f"\n✓ {desc} 已設定")
            if not ui.ask_yes_no("保留此設定？"):
                for v in feature_vars:
                    variables.pop(v["key"], None)
                all_set = False

        if not all_set:
            # 每次都問，不記錄拒絕
            print(f"\n{desc}")
            if ui.ask_yes_no("是否要設定此功能？"):
                for v in feature_vars:
                    ui.show_var(v)
                    # 處理 bool 類型變數
                    if v.get("type") == "bool":
                        variables[v["key"]] = ui.ask_yes_no("  啟用？", v.get("default", False))
                    elif v.get("auto_generate"):
                        # 自動產生的變數（如 API Key）
                        str_value = ui.get_input(
                            "  輸入值（留空自動產生）", None, v.get("secret", False)
                        )
                        if str_value:
                            variables[v["key"]] = str_value
                        else:
                            variables[v["key"]] = generate_api_key()
                            ui.success("已自動產生")
                    else:
                        str_value = ui.get_input(
                            "  輸入值", v.get("default"), v.get("secret", False)
                        )
                        if str_value:
                            variables[v["key"]] = str_value

    state.variables = variables
    state.save()
    return True
