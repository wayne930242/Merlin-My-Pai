"""測試 config 設定"""

from setup.config import (
    OPTIONAL_FEATURES,
    PLAYBOOKS,
    REQUIRED_VARS,
)


class TestRequiredVars:
    """REQUIRED_VARS 測試"""

    def test_required_vars_not_empty(self) -> None:
        """測試必要變數非空"""
        assert len(REQUIRED_VARS) > 0

    def test_required_vars_have_keys(self) -> None:
        """測試所有必要變數都有 key"""
        for var in REQUIRED_VARS:
            assert "key" in var
            assert "prompt" in var
            assert "help" in var

    def test_required_vars_keys(self) -> None:
        """測試必要變數包含預期的 key"""
        keys = [v["key"] for v in REQUIRED_VARS]
        expected = [
            "vault_server_ip",
            "pai_agent_user",
            "vault_local_ssh_key_path",
            "vault_site_domain",
            "telegram_bot_token",
            "telegram_allowed_user_ids",
            "github_token",
            "github_username",
        ]
        assert keys == expected

    def test_secret_vars_marked(self) -> None:
        """測試敏感變數有標記 secret"""
        secret_keys = [v["key"] for v in REQUIRED_VARS if v.get("secret")]
        assert "telegram_bot_token" in secret_keys
        assert "github_token" in secret_keys


class TestOptionalFeatures:
    """OPTIONAL_FEATURES 測試"""

    def test_optional_features_not_empty(self) -> None:
        """測試可選功能非空"""
        assert len(OPTIONAL_FEATURES) > 0

    def test_optional_features_have_required_fields(self) -> None:
        """測試所有功能都有必要欄位"""
        for feature in OPTIONAL_FEATURES:
            assert "name" in feature
            assert "description" in feature
            assert "vars" in feature
            assert len(feature["vars"]) > 0

    def test_feature_names(self) -> None:
        """測試功能名稱"""
        names = [f["name"] for f in OPTIONAL_FEATURES]
        assert "vultr" in names
        assert "anthropic" in names
        assert "google" in names
        assert "mutagen" in names

    def test_anthropic_feature_vars(self) -> None:
        """測試 anthropic 功能變數"""
        anthropic = next(f for f in OPTIONAL_FEATURES if f["name"] == "anthropic")
        var_keys = [v["key"] for v in anthropic["vars"]]

        assert "vault_anthropic_api_key" in var_keys
        assert "vault_enable_memory" in var_keys
        assert "vault_enable_fabric" in var_keys

    def test_bool_type_vars(self) -> None:
        """測試 bool 類型變數"""
        bool_vars = []
        for feature in OPTIONAL_FEATURES:
            for var in feature["vars"]:
                if var.get("type") == "bool":
                    bool_vars.append(var["key"])

        assert "vault_enable_memory" in bool_vars
        assert "vault_enable_fabric" in bool_vars
        assert "vault_use_mutagen_sync" in bool_vars

    def test_bool_vars_have_default(self) -> None:
        """測試 bool 變數有預設值"""
        for feature in OPTIONAL_FEATURES:
            for var in feature["vars"]:
                if var.get("type") == "bool":
                    assert "default" in var, f"{var['key']} missing default"


class TestPlaybooks:
    """PLAYBOOKS 測試"""

    def test_playbooks_not_empty(self) -> None:
        """測試 playbooks 非空"""
        assert len(PLAYBOOKS) > 0

    def test_playbooks_have_required_fields(self) -> None:
        """測試所有 playbook 有必要欄位"""
        for pb in PLAYBOOKS:
            assert "name" in pb
            assert "path" in pb
            assert "description" in pb
            assert "use_wrapper" in pb

    def test_playbook_names(self) -> None:
        """測試 playbook 名稱"""
        names = [pb["name"] for pb in PLAYBOOKS]
        expected = [
            "init-user",
            "setup-vps",
            "setup-caddy",
            "deploy-bot",
            "deploy-claude",
            "deploy-fabric",
        ]
        assert names == expected

    def test_init_user_no_wrapper(self) -> None:
        """測試 init-user 不使用 wrapper"""
        init_user = next(pb for pb in PLAYBOOKS if pb["name"] == "init-user")
        assert init_user["use_wrapper"] is False

    def test_deploy_fabric_optional(self) -> None:
        """測試 deploy-fabric 為可選"""
        deploy_fabric = next(pb for pb in PLAYBOOKS if pb["name"] == "deploy-fabric")
        assert deploy_fabric.get("optional") is True
        assert deploy_fabric.get("requires_var") == "vault_anthropic_api_key"
