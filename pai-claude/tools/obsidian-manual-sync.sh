#!/bin/bash
# Obsidian LiveSync 手動同步工具
# 當從外部（非 Obsidian）寫入檔案到 vault 時，手動推送到 CouchDB

# 載入環境變數
ENV_FILE="$HOME/pai-bot/.env"
[ -f "$ENV_FILE" ] && source "$ENV_FILE"

VAULT_PATH="$HOME/obsidian-vault"
COUCHDB_URL="https://${LIVESYNC_DOMAIN:-obsync.wayneh.tw}/${LIVESYNC_DATABASE:-obsidian}"
COUCHDB_USER="${LIVESYNC_USER:?LIVESYNC_USER not set}"
COUCHDB_PASS="${LIVESYNC_PASSWORD:?LIVESYNC_PASSWORD not set}"

# 檢查參數
if [ $# -eq 0 ]; then
    echo "用法: $0 <檔案路徑>"
    echo "範例: $0 Inbox/agent-browser.md"
    exit 1
fi

FILE_PATH="$1"
FULL_PATH="$VAULT_PATH/$FILE_PATH"

# 檢查檔案是否存在
if [ ! -f "$FULL_PATH" ]; then
    echo "❌ 檔案不存在: $FULL_PATH"
    exit 1
fi

# 讀取檔案內容
CONTENT=$(cat "$FULL_PATH")
MTIME=$(stat -c %Y "$FULL_PATH")
SIZE=$(stat -c %s "$FULL_PATH")

# 計算檔案 hash（LiveSync 使用 path 作為 ID）
FILE_ID="h:$(echo -n "$FILE_PATH" | sha256sum | cut -d' ' -f1 | head -c 40)"

# 檢查文件是否已存在，取得最新 _rev
EXISTING_DOC=$(curl -s -u "$COUCHDB_USER:$COUCHDB_PASS" "$COUCHDB_URL/$FILE_ID")
EXISTING_REV=$(echo "$EXISTING_DOC" | jq -r '._rev // empty')

# 建立 LiveSync 格式的文件
if [ -n "$EXISTING_REV" ]; then
    # 文件已存在，包含 _rev
    DOC_JSON=$(jq -n \
        --arg id "$FILE_ID" \
        --arg rev "$EXISTING_REV" \
        --arg path "$FILE_PATH" \
        --arg content "$CONTENT" \
        --argjson mtime "$MTIME" \
        --argjson size "$SIZE" \
        '{
            _id: $id,
            _rev: $rev,
            type: "plain",
            path: $path,
            data: $content,
            mtime: $mtime,
            size: $size,
            ctime: $mtime
        }')
else
    # 新文件
    DOC_JSON=$(jq -n \
        --arg id "$FILE_ID" \
        --arg path "$FILE_PATH" \
        --arg content "$CONTENT" \
        --argjson mtime "$MTIME" \
        --argjson size "$SIZE" \
        '{
            _id: $id,
            type: "plain",
            path: $path,
            data: $content,
            mtime: $mtime,
            size: $size,
            ctime: $mtime
        }')
fi

# 上傳到 CouchDB
echo "📤 正在同步: $FILE_PATH"
RESPONSE=$(curl -s -X PUT \
    -u "$COUCHDB_USER:$COUCHDB_PASS" \
    -H "Content-Type: application/json" \
    -d "$DOC_JSON" \
    "$COUCHDB_URL/$FILE_ID")

if echo "$RESPONSE" | jq -e '.ok' > /dev/null 2>&1; then
    echo "✅ 同步成功！"
    echo "$RESPONSE" | jq -r '"文件 ID: \(.id)\nRevision: \(.rev)"'
else
    echo "❌ 同步失敗："
    echo "$RESPONSE" | jq '.'
    exit 1
fi
