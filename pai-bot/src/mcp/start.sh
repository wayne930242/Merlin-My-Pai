#!/bin/bash
# MCP Server 啟動腳本
# 從 pai-bot .env 讀取環境變數

cd /home/pai/pai-bot

# 讀取 .env 檔案
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

exec /home/pai/.bun/bin/bun run src/mcp/server.ts
