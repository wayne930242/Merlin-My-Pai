import { useCallback, useRef, useState } from 'react'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { ChatView } from '@/components/chat/chat-view'
import { useWs, type WsEvent } from '@/hooks/use-websocket'
import { Separator } from '@/components/ui/separator'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

// WebSocket URL（開發時可調整）
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws'
const API_KEY = import.meta.env.VITE_API_KEY || ''
const WS_URL = API_KEY ? `${WS_BASE_URL}?key=${API_KEY}` : WS_BASE_URL

function App() {
  const [currentView, setCurrentView] = useState<'chat' | 'memory' | 'history' | 'settings'>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')

  // 使用 ref 追蹤最新的回應內容（解決 closure 問題）
  const responseRef = useRef('')

  const handleWsMessage = useCallback((event: WsEvent) => {
    switch (event.type) {
      case 'chat:start':
        setIsLoading(true)
        setCurrentResponse('')
        responseRef.current = ''
        break

      case 'chat:text':
      case 'claude:text':
        // 更新回應
        responseRef.current = event.content as string
        setCurrentResponse(event.content as string)
        break

      case 'chat:done':
        if (responseRef.current) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: responseRef.current,
              timestamp: Date.now(),
            },
          ])
        }
        setIsLoading(false)
        setCurrentResponse('')
        responseRef.current = ''
        break

      case 'chat:error':
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Error: ${event.error}`,
            timestamp: Date.now(),
          },
        ])
        setIsLoading(false)
        setCurrentResponse('')
        responseRef.current = ''
        break
    }
  }, [])

  const { isConnected, sendChat } = useWs({
    url: WS_URL,
    onMessage: handleWsMessage,
  })

  const handleSendMessage = useCallback((content: string) => {
    // 添加用戶訊息
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: Date.now(),
      },
    ])

    // 發送到 WebSocket
    sendChat(content)
    setIsLoading(true)
  }, [sendChat])

  return (
    <SidebarProvider>
      <AppSidebar
        isConnected={isConnected}
        currentView={currentView}
        onViewChange={setCurrentView}
      />
      <SidebarInset>
        <header className="flex h-12 sm:h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-base sm:text-lg font-semibold capitalize">{currentView}</h1>
        </header>

        <main className="flex-1 overflow-hidden">
          {currentView === 'chat' && (
            <ChatView
              messages={messages}
              isLoading={isLoading}
              currentResponse={currentResponse}
              onSendMessage={handleSendMessage}
            />
          )}

          {currentView === 'memory' && (
            <div className="p-4 text-center text-muted-foreground">
              Memory Manager (Coming Soon)
            </div>
          )}

          {currentView === 'history' && (
            <div className="p-4 text-center text-muted-foreground">
              History Browser (Coming Soon)
            </div>
          )}

          {currentView === 'settings' && (
            <div className="p-4 text-center text-muted-foreground">
              Settings (Coming Soon)
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
