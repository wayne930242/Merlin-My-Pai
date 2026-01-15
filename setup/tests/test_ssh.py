"""測試 SSH 工具"""

import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

from setup.utils.ssh import generate_ssh_key, validate_ssh_private_key_path


class TestGenerateSshKey:
    """generate_ssh_key 測試"""

    def test_successful_generation(self) -> None:
        """測試成功產生 SSH Key"""
        # 實際呼叫 ssh-keygen 測試
        private_key, public_key = generate_ssh_key()

        assert private_key is not None
        assert public_key is not None
        assert "-----BEGIN OPENSSH PRIVATE KEY-----" in private_key
        assert "-----END OPENSSH PRIVATE KEY-----" in private_key
        assert "ssh-ed25519" in public_key
        assert "pai-agent" in public_key

    def test_command_failure(self) -> None:
        """測試命令失敗"""
        with patch("setup.utils.ssh.run_command") as mock_run:
            mock_run.return_value = MagicMock(returncode=1)
            private_key, public_key = generate_ssh_key()

        assert private_key is None
        assert public_key is None

    def test_command_exception(self) -> None:
        """測試命令異常"""
        with patch("setup.utils.ssh.run_command") as mock_run:
            mock_run.return_value = None
            private_key, public_key = generate_ssh_key()

        assert private_key is None
        assert public_key is None


class TestValidateSshPrivateKeyPath:
    """validate_ssh_private_key_path 測試"""

    def test_public_key_path_rejected(self) -> None:
        """測試公鑰路徑被拒絕"""
        is_valid, message = validate_ssh_private_key_path("~/.ssh/id_rsa.pub")

        assert not is_valid
        assert "公鑰" in message
        assert ".pub" in message
        assert "id_rsa" in message  # 應該建議私鑰路徑

    def test_nonexistent_path_rejected(self) -> None:
        """測試不存在的路徑被拒絕"""
        is_valid, message = validate_ssh_private_key_path("~/.ssh/nonexistent_key")

        assert not is_valid
        assert "不存在" in message

    def test_directory_rejected(self) -> None:
        """測試目錄被拒絕"""
        is_valid, message = validate_ssh_private_key_path("~/.ssh/")

        assert not is_valid
        assert "不是檔案" in message

    def test_invalid_permissions_rejected(self) -> None:
        """測試不安全的權限被拒絕"""
        with tempfile.NamedTemporaryFile(mode="w", delete=False) as f:
            f.write("-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----")
            key_path = f.name

        try:
            # 設定不安全的權限 (0644)
            Path(key_path).chmod(0o644)

            is_valid, message = validate_ssh_private_key_path(key_path)

            assert not is_valid
            assert "權限" in message
            assert "0600" in message or "0400" in message
        finally:
            Path(key_path).unlink()

    def test_invalid_content_rejected(self) -> None:
        """測試非 SSH key 內容被拒絕"""
        with tempfile.NamedTemporaryFile(mode="w", delete=False) as f:
            f.write("This is not an SSH key")
            key_path = f.name

        try:
            Path(key_path).chmod(0o600)

            is_valid, message = validate_ssh_private_key_path(key_path)

            assert not is_valid
            assert "SSH 私鑰" in message
        finally:
            Path(key_path).unlink()

    def test_valid_key_accepted(self) -> None:
        """測試有效的 SSH key 被接受"""
        with tempfile.NamedTemporaryFile(mode="w", delete=False) as f:
            f.write("-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----")
            key_path = f.name

        try:
            Path(key_path).chmod(0o600)

            is_valid, message = validate_ssh_private_key_path(key_path)

            assert is_valid
            assert "✓" in message
        finally:
            Path(key_path).unlink()

    def test_real_ssh_key_accepted(self) -> None:
        """測試真實產生的 SSH key 被接受"""
        # 產生真實的 SSH key
        private_key, public_key = generate_ssh_key()
        assert private_key is not None

        with tempfile.NamedTemporaryFile(mode="w", delete=False) as f:
            f.write(private_key)
            key_path = f.name

        try:
            Path(key_path).chmod(0o600)

            is_valid, message = validate_ssh_private_key_path(key_path)

            assert is_valid
            assert "✓" in message
        finally:
            Path(key_path).unlink()
