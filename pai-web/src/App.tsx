import { useCallback, useRef, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { ChatView } from '@/components/chat/chat-view'
import { MemoryView } from '@/components/memory/memory-view'
import { HistoryView } from '@/components/history/history-view'
import { WorkspaceView } from '@/components/workspace/workspace-view'
import { LogsView, type LogEntry, type Notification } from '@/components/logs/logs-view'
import { SettingsView } from '@/components/settings/settings-view'
import { useWs, type WsEvent } from '@/hooks/use-websocket'
import { Separator } from '@/components/ui/separator'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

// WebSocket URL
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws'
const API_KEY = import.meta.env.VITE_API_KEY || ''
const WS_URL = API_KEY ? `${WS_BASE_URL}?key=${API_KEY}` : WS_BASE_URL

// 限制數量
const MAX_LOGS = 500
const MAX_NOTIFICATIONS = 100

// 路由對應的標題
const routeTitles: Record<string, string> = {
  '/': 'Chat',
  '/chat': 'Chat',
  '/memory': 'Memory',
  '/history': 'History',
  '/workspace': 'Workspace',
  '/logs': 'Logs',
  '/settings': 'Settings',
}

function App() {
  const navigate = useNavigate()
  const location = useLocation()

  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [currentResponse, setCurrentResponse] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])

  const responseRef = useRef('')

  // 從路徑取得當前 view
  const currentView = location.pathname === '/' ? 'chat' : location.pathname.slice(1) as 'chat' | 'memory' | 'history' | 'workspace' | 'logs' | 'settings'
  const pageTitle = routeTitles[location.pathname] || 'Chat'

  const handleViewChange = useCallback((view: string) => {
    navigate(view === 'chat' ? '/' : `/${view}`)
  }, [navigate])

  const handleWsMessage = useCallback((event: WsEvent) => {
    switch (event.type) {
      case 'chat:start':
        setIsLoading(true)
        setCurrentResponse('')
        responseRef.current = ''
        break

      case 'chat:text':
      case 'claude:text':
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

      case 'log:entry':
        setLogs((prev) => {
          const newLog: LogEntry = {
            id: crypto.randomUUID(),
            level: event.level as LogEntry['level'],
            msg: event.msg as string,
            context: event.context as string | undefined,
            timestamp: event.timestamp as number,
          }
          const updated = [...prev, newLog]
          return updated.slice(-MAX_LOGS)
        })
        break

      case 'notify:message':
        setNotifications((prev) => {
          const newNotif: Notification = {
            id: crypto.randomUUID(),
            sessionId: event.sessionId as number | undefined,
            platform: event.platform as string | undefined,
            message: event.message as string,
            timestamp: event.timestamp as number,
          }
          const updated = [...prev, newNotif]
          return updated.slice(-MAX_NOTIFICATIONS)
        })
        break

      case 'log:init':
        setLogs(
          ((event.logs as Array<Omit<LogEntry, 'id'>>) || []).map((log) => ({
            ...log,
            id: crypto.randomUUID(),
          }))
        )
        break

      case 'notify:init':
        setNotifications(
          ((event.notifications as Array<Omit<Notification, 'id'>>) || []).map((n) => ({
            ...n,
            id: crypto.randomUUID(),
          }))
        )
        break
    }
  }, [])

  const { isConnected, sendChat } = useWs({
    url: WS_URL,
    onMessage: handleWsMessage,
  })

  const handleSendMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: Date.now(),
      },
    ])
    sendChat(content)
    setIsLoading(true)
  }, [sendChat])

  return (
    <SidebarProvider>
      <AppSidebar
        isConnected={isConnected}
        currentView={currentView}
        onViewChange={handleViewChange}
      />
      <SidebarInset>
        <header className="flex h-12 sm:h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-base sm:text-lg font-semibold">{pageTitle}</h1>
        </header>

        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route
              path="/"
              element={
                <ChatView
                  messages={messages}
                  isLoading={isLoading}
                  currentResponse={currentResponse}
                  onSendMessage={handleSendMessage}
                  onClearMessages={() => setMessages([])}
                />
              }
            />
            <Route
              path="/chat"
              element={
                <ChatView
                  messages={messages}
                  isLoading={isLoading}
                  currentResponse={currentResponse}
                  onSendMessage={handleSendMessage}
                  onClearMessages={() => setMessages([])}
                />
              }
            />
            <Route path="/memory" element={<MemoryView />} />
            <Route path="/history" element={<HistoryView />} />
            <Route path="/workspace" element={<WorkspaceView />} />
            <Route
              path="/logs"
              element={
                <LogsView
                  logs={logs}
                  notifications={notifications}
                  onClearLogs={() => setLogs([])}
                  onClearNotifications={() => setNotifications([])}
                />
              }
            />
            <Route
              path="/settings"
              element={
                <SettingsView
                  isConnected={isConnected}
                  onClearMessages={() => setMessages([])}
                  onClearLogs={() => setLogs([])}
                  onClearNotifications={() => setNotifications([])}
                />
              }
            />
          </Routes>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
