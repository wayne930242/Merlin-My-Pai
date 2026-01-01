"""使用者介面工具"""

from getpass import getpass


def header(text: str):
    """印出標題"""
    print(f"\n{'='*60}")
    print(f"  {text}")
    print(f"{'='*60}\n")


def step(current: int, total: int, text: str):
    """印出步驟"""
    print(f"\n[{current}/{total}] {text}")
    print("-" * 40)


def success(text: str):
    """成功訊息"""
    print(f"✓ {text}")


def error(text: str):
    """錯誤訊息"""
    print(f"✗ {text}")


def skip(text: str):
    """跳過訊息"""
    print(f"⊘ {text}")


def ask_yes_no(prompt: str, default: bool = True) -> bool:
    """詢問是否確認"""
    suffix = " [Y/n]: " if default else " [y/N]: "
    while True:
        answer = input(prompt + suffix).strip().lower()
        if not answer:
            return default
        if answer in ("y", "yes"):
            return True
        if answer in ("n", "no"):
            return False
        print("請輸入 y 或 n")


def get_input(prompt: str, default: str | None = None, secret: bool = False) -> str | None:
    """取得使用者輸入"""
    if default:
        display = f"{prompt} [{default}]: "
    else:
        display = f"{prompt}: "

    if secret:
        value = getpass(display)
    else:
        value = input(display).strip()

    return value if value else default


def show_var(var: dict, value: str | None = None):
    """顯示變數說明"""
    print(f"\n{var['prompt']}")
    print(f"  說明: {var['help']}")
    if value:
        display = "********" if var.get("secret") else value
        print(f"  目前值: {display}")
