#!/usr/bin/env python3
"""
PAI Infrastructure Setup Wizard
用法: python -m setup
"""

import sys

from . import ui
from .config import ANSIBLE_DIR
from .state import SetupState
from .steps import (
    collect_optional_vars,
    collect_required_vars,
    create_vault_file,
    run_playbooks,
    setup_vault_password,
)


def show_progress(state: SetupState):
    """顯示進度"""
    summary = state.summary()
    print("偵測到先前的設定進度")
    print(f"  - Vault 密碼: {'✓' if summary['vault_password'] else '✗'}")
    print(f"  - Vault 檔案: {'✓' if summary['vault_file'] else '✗'}")
    print(f"  - 變數數量: {summary['variables_count']}")
    print(f"  - 已完成 Playbooks: {summary['playbooks_count']}")


def main():
    ui.header("PAI Infrastructure Setup Wizard")

    # 檢查 ansible 目錄
    if not ANSIBLE_DIR.exists():
        ui.error(f"找不到 ansible 目錄: {ANSIBLE_DIR}")
        sys.exit(1)

    # 載入狀態
    state = SetupState.load()

    if state.has_progress():
        show_progress(state)

        if not ui.ask_yes_no("\n繼續之前的進度？"):
            if ui.ask_yes_no("確定要重新開始？所有進度將被清除", default=False):
                state.reset()

    # 執行設定流程
    try:
        if not setup_vault_password(state):
            sys.exit(1)

        if not collect_required_vars(state):
            sys.exit(1)

        if not collect_optional_vars(state):
            sys.exit(1)

        if not create_vault_file(state):
            sys.exit(1)

        if ui.ask_yes_no("\n是否要執行初始化 Playbooks？"):
            if not run_playbooks(state):
                sys.exit(1)

    except KeyboardInterrupt:
        print("\n\n中斷。進度已儲存，可以使用 python -m setup 繼續。")
        sys.exit(0)

    ui.header("設定完成！")
    print("所有設定已完成。")
    print("\n常用指令：")
    print("  ./sync.py start                 # 啟動同步")
    print("  ./ansible/scripts/ansible-wrapper.sh ansible-playbook \\")
    print("      -i ansible/inventory ansible/playbooks/deploy-bot.yml")
    print("\n如需重新設定，執行 uv run python -m setup")


if __name__ == "__main__":
    main()
