import { useSettings, type Settings } from '@/hooks/use-settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Moon, Sun, Monitor, Trash2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingsViewProps {
  isConnected: boolean
  onClearMessages: () => void
  onClearLogs: () => void
  onClearNotifications: () => void
}

const themeOptions: { value: Settings['theme']; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export function SettingsView({
  isConnected,
  onClearMessages,
  onClearLogs,
  onClearNotifications,
}: SettingsViewProps) {
  const { settings, setSettings, resetSettings } = useSettings()

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws'
  const hasApiKey = !!import.meta.env.VITE_API_KEY

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      {/* Connection Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection</CardTitle>
          <CardDescription>API and WebSocket connection status</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={isConnected ? 'default' : 'destructive'}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">API URL</span>
            <code className="text-xs bg-muted px-2 py-1 rounded">{apiUrl}</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">WebSocket URL</span>
            <code className="text-xs bg-muted px-2 py-1 rounded">{wsUrl}</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">API Key</span>
            <Badge variant={hasApiKey ? 'secondary' : 'outline'}>
              {hasApiKey ? 'Configured' : 'Not Set'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Customize the look and feel</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Theme</span>
            <div className="flex gap-1">
              {themeOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={settings.theme === option.value ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSettings({ theme: option.value })}
                  className={cn(
                    'gap-1.5',
                    settings.theme === option.value && 'pointer-events-none'
                  )}
                >
                  <option.icon className="h-4 w-4" />
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data</CardTitle>
          <CardDescription>Manage local data and cache</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm">Chat Messages</span>
              <p className="text-xs text-muted-foreground">Clear current session messages</p>
            </div>
            <Button variant="outline" size="sm" onClick={onClearMessages}>
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm">Logs</span>
              <p className="text-xs text-muted-foreground">Clear bot logs</p>
            </div>
            <Button variant="outline" size="sm" onClick={onClearLogs}>
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm">Notifications</span>
              <p className="text-xs text-muted-foreground">Clear HQ notifications</p>
            </div>
            <Button variant="outline" size="sm" onClick={onClearNotifications}>
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reset */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reset</CardTitle>
          <CardDescription>Reset all settings to defaults</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={resetSettings}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
