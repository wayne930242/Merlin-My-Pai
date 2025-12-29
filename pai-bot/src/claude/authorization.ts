/**
 * 授權管理 - 追蹤需要權限確認的請求
 */

interface PendingRequest {
  originalPrompt: string;
  conversationHistory?: string;
  timestamp: number;
}

// 每個用戶最多保留一個待授權請求
const pendingRequests = new Map<number, PendingRequest>();

// 請求過期時間（5 分鐘）
const EXPIRY_MS = 5 * 60 * 1000;

/**
 * 儲存待授權的請求
 */
export function savePendingRequest(
  userId: number,
  prompt: string,
  history?: string
): void {
  pendingRequests.set(userId, {
    originalPrompt: prompt,
    conversationHistory: history,
    timestamp: Date.now(),
  });
}

/**
 * 取得並清除待授權的請求
 */
export function getPendingRequest(userId: number): PendingRequest | null {
  const request = pendingRequests.get(userId);

  if (!request) return null;

  // 檢查是否過期
  if (Date.now() - request.timestamp > EXPIRY_MS) {
    pendingRequests.delete(userId);
    return null;
  }

  // 取得後清除
  pendingRequests.delete(userId);
  return request;
}

/**
 * 檢查訊息是否為授權確認
 */
export function isApprovalMessage(text: string): boolean {
  const approvalPatterns = [
    /^是$/,
    /^好$/,
    /^可以$/,
    /^允許$/,
    /^確認$/,
    /^同意$/,
    /^授權$/,
    /^y$/i,
    /^yes$/i,
    /^ok$/i,
    /^approve$/i,
  ];

  const trimmed = text.trim();
  return approvalPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * 檢查訊息是否為拒絕
 */
export function isRejectionMessage(text: string): boolean {
  const rejectionPatterns = [
    /^不要$/,
    /^取消$/,
    /^算了$/,
    /^no$/i,
    /^cancel$/i,
    /^拒絕$/,
    /^不$/,
  ];

  const trimmed = text.trim();
  return rejectionPatterns.some(pattern => pattern.test(trimmed));
}
