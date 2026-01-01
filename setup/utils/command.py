"""命令執行工具"""

import subprocess
from pathlib import Path


def run_command(
    cmd: list,
    cwd: Path | None = None,
    capture: bool = True,
    check: bool = False,
) -> subprocess.CompletedProcess | None:
    """
    執行命令

    Args:
        cmd: 命令列表
        cwd: 工作目錄
        capture: 是否捕獲輸出
        check: 失敗時是否報錯

    Returns:
        CompletedProcess 或 None（失敗時）
    """
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=capture,
            text=True,
        )
        if check and result.returncode != 0:
            return None
        return result
    except Exception:
        return None


def run_playbook(
    playbook_path: str,
    root_dir: Path,
    use_wrapper: bool = True,
) -> bool:
    """
    執行 Ansible Playbook

    從專案根目錄執行，ansible.cfg 會自動設定 inventory 和 vault_password_file。

    Args:
        playbook_path: 相對於 ansible 目錄的路徑（如 playbooks/deploy-bot.yml）
        root_dir: 專案根目錄（ansible.cfg 所在處）
        use_wrapper: 是否使用 wrapper（wrapper 會解密 SSH key）

    Returns:
        是否成功
    """
    import sys

    full_playbook_path = f"ansible/{playbook_path}"

    if use_wrapper:
        # 使用 Python scripts 模組
        cmd = [
            sys.executable,
            "-m",
            "scripts",
            "ansible",
            "ansible-playbook",
            full_playbook_path,
        ]
    else:
        # init-user 用 root 連接，不需要 wrapper 解密的 SSH key
        cmd = [
            "ansible-playbook",
            full_playbook_path,
        ]

    print(f"  執行: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=root_dir)
    return result.returncode == 0
