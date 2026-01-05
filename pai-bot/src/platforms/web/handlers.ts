/**
 * Web Platform Handlers
 * 處理來自 Web Dashboard 的訊息和指令
 */

import { sendToClient } from "../../api/websocket";
import { streamClaude } from "../../claude/client";
import { config } from "../../config";
import { contextManager } from "../../context/manager";
import { emitEvent, paiEvents } from "../../events";
import { formatMemoriesForPrompt, memoryManager } from "../../memory";

// Web 平台的 userId（使用固定 ID，因為目前只有單用戶）
const WEB_USER_ID = config.telegram.allowedUserIds[0] || 1;

// 進行中的任務
const activeTasks = new Map<number, AbortController>();

/**
 * 處理來自 Web 的聊天訊息
 */
export async function handleWebChat(
  clientId: string,
  content: string
): Promise<void> {
  const userId = WEB_USER_ID;

  // 發送訊息進入事件
  emitEvent("message:in", {
    platform: "web",
    userId,
    content,
  });

  // 檢查是否為指令
  if (content.startsWith("/")) {
    await handleCommand(clientId, content);
    return;
  }

  // 如果有進行中的任務，先中斷
  const existingController = activeTasks.get(userId);
  if (existingController) {
    existingController.abort();
    activeTasks.delete(userId);
  }

  // 建立新的 AbortController
  const abortController = new AbortController();
  activeTasks.set(userId, abortController);

  // 儲存用戶訊息
  contextManager.saveMessage(userId, "user", content);

  // 取得對話歷史
  const history = contextManager.getConversationContext(userId);

  // 取得相關記憶
  let memoryContext = "";
  if (config.memory.enabled) {
    try {
      const memories = await memoryManager.search(userId, content, 5);
      if (memories.length > 0) {
        memoryContext = formatMemoriesForPrompt(memories);
      }
    } catch {
      // 忽略記憶搜尋錯誤
    }
  }

  // 構建 prompt
  let prompt = content;
  if (memoryContext) {
    prompt = `[相關記憶]\n${memoryContext}\n\n${prompt}`;
  }

  // 通知客戶端開始處理
  sendToClient(clientId, {
    type: "chat:start",
    timestamp: Date.now(),
  });

  try {
    let fullResponse = "";

    // 串流執行 Claude
    for await (const event of streamClaude(prompt, {
      conversationHistory: history,
      userId,
      signal: abortController.signal,
      platform: "web",
    })) {
      if (event.type === "thinking") {
        // 思考過程已透過 paiEvents 廣播
      } else if (event.type === "text") {
        fullResponse = event.content;
        sendToClient(clientId, {
          type: "chat:text",
          content: event.content,
          timestamp: Date.now(),
        });
      } else if (event.type === "done") {
        fullResponse = event.content || fullResponse;
      } else if (event.type === "error") {
        sendToClient(clientId, {
          type: "chat:error",
          error: event.content,
          timestamp: Date.now(),
        });
        return;
      }
    }

    // 儲存助手回應
    if (fullResponse) {
      contextManager.saveMessage(userId, "assistant", fullResponse);
    }

    // 通知完成
    sendToClient(clientId, {
      type: "chat:done",
      timestamp: Date.now(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendToClient(clientId, {
      type: "chat:error",
      error: errorMessage,
      timestamp: Date.now(),
    });
  } finally {
    activeTasks.delete(userId);
  }
}

/**
 * 處理指令
 */
async function handleCommand(
  clientId: string,
  content: string
): Promise<void> {
  const [command] = content.slice(1).split(" ");
  const userId = WEB_USER_ID;

  switch (command.toLowerCase()) {
    case "clear":
      contextManager.clearHistory(userId);
      sendToClient(clientId, {
        type: "command:response",
        command: "clear",
        message: "對話歷史已清除",
        timestamp: Date.now(),
      });
      break;

    case "status": {
      const messageCount = contextManager.getMessageCount(userId);
      const isProcessing = activeTasks.has(userId);
      sendToClient(clientId, {
        type: "command:response",
        command: "status",
        data: {
          userId,
          messageCount,
          isProcessing,
        },
        timestamp: Date.now(),
      });
      break;
    }

    case "stop": {
      const controller = activeTasks.get(userId);
      if (controller) {
        controller.abort();
        activeTasks.delete(userId);
        sendToClient(clientId, {
          type: "command:response",
          command: "stop",
          message: "已中斷任務",
          timestamp: Date.now(),
        });
      } else {
        sendToClient(clientId, {
          type: "command:response",
          command: "stop",
          message: "目前沒有進行中的任務",
          timestamp: Date.now(),
        });
      }
      break;
    }

    default:
      // 未知指令，當作一般訊息處理
      await handleWebChat(clientId, content);
  }
}

/**
 * 初始化 Web 平台
 */
export function initWebPlatform(): void {
  // 監聽 web:chat 事件
  paiEvents.on("web:chat", (data) => {
    handleWebChat(data.clientId, data.content).catch(console.error);
  });

  console.log("[Web] Platform initialized");
}
