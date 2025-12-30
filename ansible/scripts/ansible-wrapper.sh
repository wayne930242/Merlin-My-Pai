#!/bin/bash
# Wrapper script that extracts SSH key from vault before running ansible
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANSIBLE_DIR="$(dirname "$SCRIPT_DIR")"
KEY_FILE="/tmp/.pai_agent_key_$$"

cleanup() {
    rm -f "$KEY_FILE" 2>/dev/null
}
trap cleanup EXIT

# Extract private key from vault
cd "$ANSIBLE_DIR"
ansible-vault decrypt inventory/group_vars/all/vault.yml --output=- 2>/dev/null | \
    grep -A10 "pai_agent_ssh_private_key:" | \
    tail -n +2 | \
    sed 's/^  //' > "$KEY_FILE"
chmod 600 "$KEY_FILE"

# Export for ansible to use
export PAI_SSH_KEY_FILE="$KEY_FILE"

# Run ansible with the key
exec "$@"
