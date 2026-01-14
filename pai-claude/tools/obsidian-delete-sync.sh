#!/bin/bash
# Obsidian LiveSync 刪除同步工具
# 當從外部（非 Obsidian）刪除檔案時，同步刪除 CouchDB 的文件

# 載入環境變數
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
[ -f "$ENV_FILE" ] && source "$ENV_FILE"

VAULT_PATH="$HOME/obsidian-vault"
COUCHDB_URL="https://${LIVESYNC_DOMAIN:-obsync.wayneh.tw}/${LIVESYNC_DATABASE:-obsidian}"
COUCHDB_USER="${LIVESYNC_USER:?LIVESYNC_USER not set}"
COUCHDB_PASS="${LIVESYNC_PASSWORD:?LIVESYNC_PASSWORD not set}"

# 檢查參數
if [ $# -eq 0 ]; then
    echo "用法: $0 <檔案路徑>"
    echo "範例: $0 Inbox/test.md"
    exit 1
fi

FILE_PATH="$1"

# 計算檔案 hash（LiveSync 使用 path 作為 ID）
FILE_ID="h:$(echo -n "$FILE_PATH" | sha256sum | cut -d' ' -f1 | head -c 40)"

# 檢查文件是否存在於 CouchDB
EXISTING_DOC=$(curl -s -u "$COUCHDB_USER:$COUCHDB_PASS" "$COUCHDB_URL/$FILE_ID")

# 檢查是否為錯誤回應
if echo "$EXISTING_DOC" | jq -e '.error' > /dev/null 2>&1; then
    ERROR_TYPE=$(echo "$EXISTING_DOC" | jq -r '.error')
    if [ "$ERROR_TYPE" == "not_found" ]; then
        echo "ℹ️  檔案在 CouchDB 中不存在，無需刪除: $FILE_PATH"
        exit 0
    else
        echo "❌ 查詢 CouchDB 時發生錯誤："
        echo "$EXISTING_DOC" | jq '.'
        exit 1
    fi
fi

# 取得最新 _rev
EXISTING_REV=$(echo "$EXISTING_DOC" | jq -r '._rev')

if [ -z "$EXISTING_REV" ] || [ "$EXISTING_REV" == "null" ]; then
    echo "❌ 無法取得文件的 _rev"
    exit 1
fi

# 刪除 CouchDB 文件
echo "🗑️  正在刪除: $FILE_PATH"
RESPONSE=$(curl -s -X DELETE \
    -u "$COUCHDB_USER:$COUCHDB_PASS" \
    "$COUCHDB_URL/$FILE_ID?rev=$EXISTING_REV")

if echo "$RESPONSE" | jq -e '.ok' > /dev/null 2>&1; then
    echo "✅ 刪除成功！"
    echo "$RESPONSE" | jq -r '"文件 ID: \(.id)\nRevision: \(.rev)"'
else
    echo "❌ 刪除失敗："
    echo "$RESPONSE" | jq '.'
    exit 1
fi
