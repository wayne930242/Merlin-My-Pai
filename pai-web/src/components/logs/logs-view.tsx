import { useEffect, useRef, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trash2, Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface LogEntry {
  id: string
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  msg: string
  context?: string
  timestamp: number
}

export interface Notification {
  id: string
  sessionId?: number
  platform?: string
  message: string
  timestamp: number
}

interface LogsViewProps {
  logs: LogEntry[]
  notifications: Notification[]
  onClearLogs: () => void
  onClearNotifications: () => void
}

const levelColors: Record<LogEntry['level'], string> = {
  debug: 'bg-gray-500',
  info: 'bg-blue-500',
  warn: 'bg-yellow-500',
  error: 'bg-red-500',
  fatal: 'bg-red-700',
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function LogsView({ logs, notifications, onClearLogs, onClearNotifications }: LogsViewProps) {
  const [isPaused, setIsPaused] = useState(false)
  const [activeTab, setActiveTab] = useState<'logs' | 'notifications'>('logs')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new logs arrive (if not paused)
  useEffect(() => {
    if (!isPaused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, notifications, isPaused])

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex items-center gap-2 p-3 border-b">
        <Button
          variant={activeTab === 'logs' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('logs')}
        >
          Logs
          <Badge variant="secondary" className="ml-2">
            {logs.length}
          </Badge>
        </Button>
        <Button
          variant={activeTab === 'notifications' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('notifications')}
        >
          Notifications
          <Badge variant="secondary" className="ml-2">
            {notifications.length}
          </Badge>
        </Button>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsPaused(!isPaused)}
          title={isPaused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
        >
          {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={activeTab === 'logs' ? onClearLogs : onClearNotifications}
          title="Clear"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-3 space-y-1 font-mono text-xs">
          {activeTab === 'logs' ? (
            logs.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No logs yet
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    'flex items-start gap-2 py-1 px-2 rounded',
                    log.level === 'error' || log.level === 'fatal'
                      ? 'bg-red-500/10'
                      : log.level === 'warn'
                        ? 'bg-yellow-500/10'
                        : 'hover:bg-muted/50'
                  )}
                >
                  <span className="text-muted-foreground shrink-0">
                    {formatTime(log.timestamp)}
                  </span>
                  <Badge
                    variant="secondary"
                    className={cn('shrink-0 text-white', levelColors[log.level])}
                  >
                    {log.level.toUpperCase()}
                  </Badge>
                  {log.context && (
                    <span className="text-muted-foreground shrink-0">[{log.context}]</span>
                  )}
                  <span className="break-all">{log.msg}</span>
                </div>
              ))
            )
          ) : notifications.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No notifications yet
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className="flex items-start gap-2 py-2 px-2 rounded bg-primary/5 border-l-2 border-primary"
              >
                <span className="text-muted-foreground shrink-0">
                  {formatTime(notif.timestamp)}
                </span>
                {notif.platform && (
                  <Badge variant="outline" className="shrink-0">
                    {notif.platform}
                  </Badge>
                )}
                <span className="break-all">{notif.message}</span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
