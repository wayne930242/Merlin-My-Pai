"""變數收集"""

from typing import Any

from .. import ui
from ..config import OPTIONAL_FEATURES, REQUIRED_VARS
from ..state import SetupState
from ..utils import generate_ssh_key


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
                    else:
                        str_value = ui.get_input(
                            "  輸入值", v.get("default"), v.get("secret", False)
                        )
                        if str_value:
                            variables[v["key"]] = str_value

    state.variables = variables
    state.save()
    return True
