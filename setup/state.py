"""狀態管理"""

import json
from dataclasses import asdict, dataclass, field

from .config import STATE_FILE


@dataclass
class SetupState:
    vault_password_set: bool = False
    vault_created: bool = False
    vault_encrypted: bool = False
    ssh_key_generated: bool = False
    variables: dict = field(default_factory=dict)
    optional_declined: list = field(default_factory=list)
    playbooks_completed: list = field(default_factory=list)

    @classmethod
    def load(cls) -> "SetupState":
        """載入狀態"""
        if STATE_FILE.exists():
            with open(STATE_FILE) as f:
                data = json.load(f)
                return cls(**data)
        return cls()

    def save(self):
        """儲存狀態"""
        with open(STATE_FILE, "w") as f:
            json.dump(asdict(self), f, indent=2)

    def reset(self):
        """重置狀態"""
        self.vault_password_set = False
        self.vault_created = False
        self.vault_encrypted = False
        self.ssh_key_generated = False
        self.variables = {}
        self.optional_declined = []
        self.playbooks_completed = []
        self.save()

    def has_progress(self) -> bool:
        """是否有進度"""
        return any([
            self.vault_password_set,
            self.vault_created,
            self.variables,
            self.playbooks_completed,
        ])

    def summary(self) -> dict:
        """進度摘要"""
        return {
            "vault_password": self.vault_password_set,
            "vault_file": self.vault_created,
            "variables_count": len(self.variables),
            "playbooks_count": len(self.playbooks_completed),
        }
