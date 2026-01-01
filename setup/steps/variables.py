"""變數收集"""

from .. import ui
from ..config import OPTIONAL_FEATURES, REQUIRED_VARS
from ..state import SetupState
from ..utils import generate_ssh_key


def collect_required_vars(state: SetupState) -> bool:
    """收集必要變數"""
    ui.step(2, 4, "設定必要變數")

    variables = state.variables

    for var in REQUIRED_VARS:
        key = var["key"]
        current = variables.get(key)

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
    if "pai_agent_ssh_private_key" not in variables:
        print("\n需要產生用於 Ansible 部署的 SSH Key")

        if state.ssh_key_generated and "pai_agent_ssh_private_key" in variables:
            ui.success("SSH Key 已產生")
            if not ui.ask_yes_no("是否要重新產生？", default=False):
                pass
            else:
                state.ssh_key_generated = False

        if not state.ssh_key_generated:
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

    variables = state.variables

    for feature in OPTIONAL_FEATURES:
        desc = feature["description"]
        feature_vars = feature["vars"]

        # 檢查是否已設定
        all_set = all(variables.get(v["key"]) for v in feature_vars)

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
                    value = ui.get_input("  輸入值", v.get("default"), v.get("secret", False))
                    if value:
                        variables[v["key"]] = value

    state.variables = variables
    state.save()
    return True
