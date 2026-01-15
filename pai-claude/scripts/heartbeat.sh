#!/bin/bash
# Heartbeat script for Claude Code hooks
# Sends heartbeat to pai-bot to reset idle timeout

# PAI_SESSION_ID is set by pai-bot when spawning Claude
if [ -z "$PAI_SESSION_ID" ]; then
  exit 0
fi

# Send heartbeat to pai-bot (runs on same machine)
curl -s -X POST "http://127.0.0.1:3000/internal/heartbeat" \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$PAI_SESSION_ID\"}" \
  > /dev/null 2>&1 &

# Don't wait for curl to finish (run in background)
exit 0
