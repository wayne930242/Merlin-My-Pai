import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { Brain, History, MessageSquare, Settings, Sparkles } from 'lucide-react'

interface AppSidebarProps {
  isConnected: boolean
  currentView: 'chat' | 'memory' | 'history' | 'settings'
  onViewChange: (view: 'chat' | 'memory' | 'history' | 'settings') => void
}

const menuItems = [
  { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
  { id: 'memory' as const, label: 'Memory', icon: Brain },
  { id: 'history' as const, label: 'History', icon: History },
  { id: 'settings' as const, label: 'Settings', icon: Settings },
]

export function AppSidebar({ isConnected, currentView, onViewChange }: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">Merlin</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={currentView === item.id}
                    onClick={() => onViewChange(item.id)}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <div className="flex items-center gap-2">
          <Badge variant={isConnected ? 'default' : 'destructive'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
