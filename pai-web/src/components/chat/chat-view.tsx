import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { Send, User, Sparkles, Loader2 } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface ChatViewProps {
  messages: Message[]
  isLoading: boolean
  currentResponse: string
  onSendMessage: (content: string) => void
}

export function ChatView({ messages, isLoading, currentResponse, onSendMessage }: ChatViewProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const isComposingRef = useRef(false) // 追蹤 IME 輸入狀態

  // 自動滾動到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, currentResponse])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    onSendMessage(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 如果正在使用 IME 輸入（中文、日文等），不要送出
    if (isComposingRef.current) return

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleCompositionStart = () => {
    isComposingRef.current = true
  }

  const handleCompositionEnd = () => {
    isComposingRef.current = false
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <ScrollArea className="flex-1 p-2 sm:p-4" ref={scrollRef}>
        <div className="space-y-3 sm:space-y-4 max-w-3xl mx-auto">
          {messages.map((msg) => (
            <Card
              key={msg.id}
              className={`p-3 sm:p-4 ${
                msg.role === 'user'
                  ? 'bg-primary/5 ml-4 sm:ml-12'
                  : 'bg-muted mr-4 sm:mr-12'
              }`}
            >
              <div className="flex gap-2 sm:gap-3">
                <Avatar className="h-6 w-6 sm:h-8 sm:w-8 shrink-0">
                  {msg.role === 'user' ? (
                    <User className="h-3 w-3 sm:h-4 sm:w-4" />
                  ) : (
                    <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                    {msg.role === 'user' ? 'You' : 'Merlin'}
                  </p>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm sm:text-base">
                    <pre className="whitespace-pre-wrap font-sans break-words">{msg.content}</pre>
                  </div>
                </div>
              </div>
            </Card>
          ))}

          {/* 正在生成的回應 */}
          {isLoading && (
            <Card className="p-3 sm:p-4 bg-muted mr-4 sm:mr-12">
              <div className="flex gap-2 sm:gap-3">
                <Avatar className="h-6 w-6 sm:h-8 sm:w-8 shrink-0">
                  <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1">Merlin</p>
                  {currentResponse ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-sm sm:text-base">
                      <pre className="whitespace-pre-wrap font-sans break-words">{currentResponse}</pre>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Thinking...</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {messages.length === 0 && !isLoading && (
            <div className="text-center py-8 sm:py-12 text-muted-foreground px-4">
              <Sparkles className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 opacity-50" />
              <p className="text-base sm:text-lg font-medium">Welcome to Merlin</p>
              <p className="text-xs sm:text-sm">Start a conversation with your AI assistant</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input - Fixed at bottom on mobile */}
      <div className="border-t p-2 sm:p-4 bg-background">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder="Type a message..."
              className="min-h-[44px] sm:min-h-[60px] max-h-[120px] sm:max-h-[200px] resize-none text-base"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="h-11 w-11 sm:h-10 sm:w-10 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 sm:mt-2 text-center hidden sm:block">
            Press Enter to send, Shift+Enter for new line
          </p>
        </form>
      </div>
    </div>
  )
}
