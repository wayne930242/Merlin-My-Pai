import { useCallback, useEffect, useRef, useState } from 'react'

export interface WsEvent {
  type: string
  [key: string]: unknown
}

interface UseWebSocketOptions {
  url: string
  onMessage?: (event: WsEvent) => void
  onConnect?: () => void
  onDisconnect?: () => void
  reconnectInterval?: number
}

export function useWebSocket({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  reconnectInterval = 3000,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [clientId, setClientId] = useState<string | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shouldReconnectRef = useRef(true)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const ws = new WebSocket(url)

      ws.onopen = () => {
        setIsConnected(true)
        onConnect?.()
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WsEvent

          // 處理連接確認
          if (data.type === 'connected' && data.clientId) {
            setClientId(data.clientId as string)
          }

          onMessage?.(data)
        } catch {
          console.error('Failed to parse WebSocket message')
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        setClientId(null)
        wsRef.current = null
        onDisconnect?.()

        // 自動重連
        if (shouldReconnectRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      wsRef.current = ws
    } catch (error) {
      console.error('Failed to create WebSocket:', error)

      // 重試
      if (shouldReconnectRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect()
        }, reconnectInterval)
      }
    }
  }, [url, onMessage, onConnect, onDisconnect, reconnectInterval])

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    wsRef.current?.close()
    wsRef.current = null
  }, [])

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  const sendChat = useCallback((content: string) => {
    send({ type: 'chat', content })
  }, [send])

  useEffect(() => {
    shouldReconnectRef.current = true
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return {
    isConnected,
    clientId,
    send,
    sendChat,
    disconnect,
    reconnect: connect,
  }
}
