import { useCallback } from 'react'
import useWebSocket, { ReadyState } from 'react-use-websocket'

export interface WsEvent {
  type: string
  [key: string]: unknown
}

interface UseWsOptions {
  url: string
  onMessage?: (event: WsEvent) => void
}

export function useWs({ url, onMessage }: UseWsOptions) {
  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(url, {
    share: true, // 共享連線
    shouldReconnect: () => true, // 自動重連
    reconnectAttempts: 50,
    reconnectInterval: 3000,
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data) as WsEvent
        onMessage?.(data)
      } catch {
        console.error('[WS] Failed to parse message')
      }
    },
    onOpen: () => console.log('[WS] Connected'),
    onClose: () => console.log('[WS] Disconnected'),
    onError: (error) => console.error('[WS] Error:', error),
  })

  const isConnected = readyState === ReadyState.OPEN

  const sendChat = useCallback((content: string) => {
    sendJsonMessage({ type: 'chat', content })
  }, [sendJsonMessage])

  // 從 lastJsonMessage 取得 clientId
  const msg = lastJsonMessage as WsEvent | null
  const clientId = msg?.type === 'connected' ? (msg.clientId as string) : null

  return {
    isConnected,
    clientId,
    send: sendJsonMessage,
    sendChat,
    readyState,
  }
}

// Re-export for convenience
export { ReadyState }
