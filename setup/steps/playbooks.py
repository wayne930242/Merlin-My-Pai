"""Playbook 執行"""

from .. import ui
from ..config import PLAYBOOKS, ROOT_DIR
from ..state import SetupState
from ..utils.command import run_playbook


def run_playbooks(state: SetupState) -> bool:
    """執行初始化 Playbooks"""
    ui.header("執行初始化 Playbooks")

    completed = state.playbooks_completed
    variables = state.variables
    total = len(PLAYBOOKS)

    for i, pb in enumerate(PLAYBOOKS, 1):
        name = pb["name"]
        path = pb["path"]
        desc = pb["description"]

        print(f"\n[{i}/{total}] {desc}")

        # 檢查是否需要特定變數
        if pb.get("requires_var") and not variables.get(pb["requires_var"]):
            ui.skip(f"跳過（需要 {pb['requires_var']}）")
            continue

        # 檢查是否已完成
        if name in completed:
            ui.success("已完成")
            if not ui.ask_yes_no("是否要重新執行？", default=False):
                continue

        print(f"  Playbook: {path}")

        # 可選項確認
        if pb.get("optional"):
            if not ui.ask_yes_no("是否要執行？"):
                continue
        else:
            if not ui.ask_yes_no("確認執行？"):
                print("  中斷設定程序")
                return False

        # 執行
        success = run_playbook(
            playbook_path=path,
            root_dir=ROOT_DIR,
            use_wrapper=pb["use_wrapper"],
        )

        if not success:
            ui.error("Playbook 執行失敗")
            if not ui.ask_yes_no("是否要繼續？", default=False):
                return False
        else:
            ui.success("完成")
            completed.append(name)
            state.playbooks_completed = completed
            state.save()

    return True
