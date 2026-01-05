import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { Send, User, Sparkles, Loader2, Paperclip, X, FileIcon } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'

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
  onClearMessages?: () => void
  onAddMessage?: (content: string, role: 'user' | 'assistant') => void
}

// 本地指令定義
const LOCAL_COMMANDS = [
  { name: '/clear', description: '清除對話紀錄' },
  { name: '/help', description: '顯示可用指令' },
  { name: '/new', description: '開始新對話' },
  { name: '/export', description: '匯出對話紀錄' },
] as const

// 幫助訊息
const HELP_MESSAGE = `## 可用指令

| 指令 | 說明 |
|------|------|
| \`/clear\` | 清除對話紀錄 |
| \`/new\` | 開始新對話（同 /clear） |
| \`/help\` | 顯示此幫助訊息 |
| \`/export\` | 匯出對話為 JSON |

## 功能

- 📎 **附件**: 點擊迴紋針按鈕上傳檔案
- 📝 **Markdown**: 訊息支援完整 Markdown 語法
- 💻 **程式碼**: 自動語法高亮
- ⌨️ **快捷鍵**: Enter 發送、Shift+Enter 換行
`

// 上傳檔案的類型
interface AttachedFile {
  file: File
  uploading: boolean
  uploaded?: { path: string; filename: string }
  error?: string
}

// API 設定
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const API_KEY = import.meta.env.VITE_API_KEY || ''

export function ChatView({ messages, isLoading, currentResponse, onSendMessage, onClearMessages, onAddMessage }: ChatViewProps) {
  const [input, setInput] = useState('')
  const [showCommands, setShowCommands] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isComposingRef = useRef(false) // 追蹤 IME 輸入狀態

  // 自動滾動到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, currentResponse])

  // 監聽輸入以顯示指令提示
  useEffect(() => {
    setShowCommands(input.startsWith('/') && input.length < 10)
  }, [input])

  // 新增本地訊息的輔助函式
  const addLocalMessage = useCallback((content: string, role: 'user' | 'assistant' = 'assistant') => {
    // 透過父元件的 callback 無法直接加入訊息，需要透過 onSendMessage 模擬
    // 但這裡我們需要一個新的 prop 來處理本地訊息
    // 暫時用 onSendMessage 帶特殊前綴
  }, [])

  // 匯出對話
  const exportChat = useCallback(() => {
    const data = {
      exported_at: new Date().toISOString(),
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp).toISOString(),
      })),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-export-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [messages])

  // 處理本地指令 - 返回要顯示的訊息（如果有）
  const handleCommand = (command: string): { handled: boolean; response?: string } => {
    const cmd = command.toLowerCase().trim()

    if (cmd === '/clear' || cmd === '/new') {
      onClearMessages?.()
      return { handled: true }
    }

    if (cmd === '/help') {
      return { handled: true, response: HELP_MESSAGE }
    }

    if (cmd === '/export') {
      if (messages.length === 0) {
        return { handled: true, response: '⚠️ 沒有對話可匯出' }
      }
      exportChat()
      return { handled: true, response: `✅ 已匯出 ${messages.length} 則訊息` }
    }

    return { handled: false } // 非本地指令，交給後端處理
  }

  // 上傳檔案
  const uploadFile = async (file: File): Promise<{ path: string; filename: string } | null> => {
    const formData = new FormData()
    formData.append('file', file)

    try {
      const url = new URL('/api/upload', API_BASE_URL)
      if (API_KEY) url.searchParams.set('key', API_KEY)

      const res = await fetch(url.toString(), {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }

      const data = await res.json()
      return { path: data.path, filename: data.filename }
    } catch (error) {
      console.error('Upload error:', error)
      return null
    }
  }

  // 處理檔案選擇
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      // 加入到 attachedFiles
      const newFile: AttachedFile = { file, uploading: true }
      setAttachedFiles(prev => [...prev, newFile])

      // 上傳
      const result = await uploadFile(file)

      setAttachedFiles(prev =>
        prev.map(f =>
          f.file === file
            ? result
              ? { ...f, uploading: false, uploaded: result }
              : { ...f, uploading: false, error: '上傳失敗' }
            : f
        )
      )
    }

    // 清空 input 以允許再次選擇相同檔案
    e.target.value = ''
  }

  // 移除附件
  const removeFile = (file: File) => {
    setAttachedFiles(prev => prev.filter(f => f.file !== file))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // 檢查是否有正在上傳的檔案
    const uploading = attachedFiles.some(f => f.uploading)
    if (uploading) return

    // 檢查是否有內容可發送
    const hasText = input.trim().length > 0
    const hasFiles = attachedFiles.some(f => f.uploaded)
    if ((!hasText && !hasFiles) || isLoading) return

    const trimmed = input.trim()

    // 嘗試處理本地指令（只有純指令，沒有附件）
    if (trimmed.startsWith('/') && !hasFiles) {
      const result = handleCommand(trimmed)
      if (result.handled) {
        // 如果有回應訊息，加入對話
        if (result.response && onAddMessage) {
          onAddMessage(result.response, 'assistant')
        }
        setInput('')
        return
      }
    }

    // 組合訊息（包含檔案路徑）
    let messageContent = trimmed
    const uploadedFiles = attachedFiles.filter(f => f.uploaded)

    if (uploadedFiles.length > 0) {
      const filePaths = uploadedFiles.map(f => f.uploaded!.path).join(', ')
      messageContent = hasText
        ? `${trimmed}\n\n[附件: ${filePaths}]`
        : `[附件: ${filePaths}]`
    }

    onSendMessage(messageContent)
    setInput('')
    setAttachedFiles([])
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
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm sm:text-base break-words">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                      {msg.content}
                    </ReactMarkdown>
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
                    <div className="prose prose-sm dark:prose-invert max-w-none text-sm sm:text-base break-words">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                        {currentResponse}
                      </ReactMarkdown>
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
      <div className="border-t p-2 sm:p-4 bg-background relative">
        {/* 指令提示 */}
        {showCommands && (
          <div className="absolute bottom-full left-0 right-0 p-2 sm:p-4">
            <div className="max-w-3xl mx-auto">
              <Card className="p-2 shadow-lg">
                <p className="text-xs text-muted-foreground mb-2 px-2">可用指令</p>
                <div className="space-y-1">
                  {LOCAL_COMMANDS.filter(cmd =>
                    cmd.name.startsWith(input.toLowerCase())
                  ).map(cmd => (
                    <button
                      type="button"
                      key={cmd.name}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2 text-sm"
                      onClick={() => {
                        setInput(cmd.name)
                        setShowCommands(false)
                      }}
                    >
                      <code className="text-primary font-mono">{cmd.name}</code>
                      <span className="text-muted-foreground">{cmd.description}</span>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          {/* 附件預覽 */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachedFiles.map((af, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
                    af.error
                      ? 'bg-destructive/10 text-destructive'
                      : af.uploading
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary/10 text-primary'
                  }`}
                >
                  {af.uploading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <FileIcon className="h-3 w-3" />
                  )}
                  <span className="max-w-[120px] truncate">{af.file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(af.file)}
                    className="hover:bg-muted rounded p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            {/* 隱藏的檔案 input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              multiple
            />

            {/* 附件按鈕 */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="h-11 w-11 sm:h-10 sm:w-10 shrink-0"
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder="輸入訊息... (/ 指令)"
              className="min-h-[44px] sm:min-h-[60px] max-h-[120px] sm:max-h-[200px] resize-none text-base"
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="icon"
              disabled={(!input.trim() && !attachedFiles.some(f => f.uploaded)) || isLoading || attachedFiles.some(f => f.uploading)}
              className="h-11 w-11 sm:h-10 sm:w-10 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 sm:mt-2 text-center hidden sm:block">
            Enter 發送 · Shift+Enter 換行 · / 指令 · 可附加檔案
          </p>
        </form>
      </div>
    </div>
  )
}
