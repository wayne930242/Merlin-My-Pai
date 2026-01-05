import { useState, useMemo } from 'react'
import { useWorkspaceList, useWorkspaceFile } from '@/hooks/use-workspace'
import type { WorkspaceEntry } from '@/lib/api'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import {
  Folder,
  FolderOpen,
  File,
  FileText,
  FileCode,
  FileJson,
  ChevronRight,
  ChevronDown,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { markdown } from '@codemirror/lang-markdown'
import { json } from '@codemirror/lang-json'
import { yaml } from '@codemirror/lang-yaml'
import { githubLight, githubDark } from '@uiw/codemirror-theme-github'
import { EditorView } from '@codemirror/view'

// 根據檔案副檔名取得語言擴展
function getLanguageExtension(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'js':
    case 'jsx':
      return javascript({ jsx: true })
    case 'ts':
    case 'tsx':
      return javascript({ jsx: true, typescript: true })
    case 'py':
      return python()
    case 'md':
      return markdown()
    case 'json':
      return json()
    case 'yml':
    case 'yaml':
      return yaml()
    default:
      return []
  }
}

// 根據檔案類型選擇圖示類型
function getFileIconType(name: string): 'json' | 'code' | 'text' | 'file' {
  const ext = name.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'json':
      return 'json'
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'sh':
    case 'yml':
    case 'yaml':
      return 'code'
    case 'md':
    case 'txt':
    case 'log':
      return 'text'
    default:
      return 'file'
  }
}

// 格式化檔案大小
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

// 檔案圖示元件
function FileIcon({ filename, className }: { filename: string; className?: string }) {
  const iconType = getFileIconType(filename)
  switch (iconType) {
    case 'json':
      return <FileJson className={className} />
    case 'code':
      return <FileCode className={className} />
    case 'text':
      return <FileText className={className} />
    default:
      return <File className={className} />
  }
}

// 樹節點元件
function TreeNode({
  entry,
  level,
  selectedFile,
  expandedDirs,
  onSelect,
  onToggle,
}: {
  entry: WorkspaceEntry
  level: number
  selectedFile: string | null
  expandedDirs: Set<string>
  onSelect: (path: string) => void
  onToggle: (path: string) => void
}) {
  const isExpanded = expandedDirs.has(entry.path)
  const isSelected = selectedFile === entry.path

  const { data } = useWorkspaceList(isExpanded ? entry.path : '')

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-0.5 px-2 cursor-pointer hover:bg-muted/50 text-sm',
          isSelected && 'bg-primary/10 text-primary'
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (entry.isDirectory) {
            onToggle(entry.path)
          } else {
            onSelect(entry.path)
          }
        }}
      >
        {entry.isDirectory ? (
          <>
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-primary" />
            )}
          </>
        ) : (
          <>
            <span className="w-3" />
            <FileIcon filename={entry.name} className="h-4 w-4 shrink-0 text-muted-foreground" />
          </>
        )}
        <span className="truncate">{entry.name}</span>
      </div>

      {entry.isDirectory && isExpanded && data?.items && (
        <div>
          {data.items.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              level={level + 1}
              selectedFile={selectedFile}
              expandedDirs={expandedDirs}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function WorkspaceView() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())

  const { data: rootData, isLoading, refetch } = useWorkspaceList('')
  const { data: fileData, isLoading: isFileLoading } = useWorkspaceFile(selectedFile || '')

  // CodeMirror 擴展
  const extensions = useMemo(() => {
    if (!selectedFile) return []
    const langExt = getLanguageExtension(selectedFile)
    return [
      EditorView.editable.of(false),
      EditorView.lineWrapping,
      ...(Array.isArray(langExt) ? langExt : [langExt]),
    ]
  }, [selectedFile])

  // 檢測系統主題
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  const handleToggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      {/* 左側檔案樹 */}
      <ResizablePanel defaultSize={30} minSize={15}>
        <div className="flex flex-col h-full border-r">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="text-xs font-semibold uppercase text-muted-foreground">
              Explorer
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="py-1">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : rootData?.items && rootData.items.length > 0 ? (
                rootData.items.map((entry) => (
                  <TreeNode
                    key={entry.path}
                    entry={entry}
                    level={0}
                    selectedFile={selectedFile}
                    expandedDirs={expandedDirs}
                    onSelect={setSelectedFile}
                    onToggle={handleToggleDir}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Empty workspace
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* 右側內容 */}
      <ResizablePanel defaultSize={70} minSize={30}>
        <div className="flex flex-col h-full">
          {selectedFile ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
                <FileIcon filename={selectedFile} className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm truncate">{selectedFile}</span>
                {fileData && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatSize(fileData.size)}
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-auto">
                {isFileLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : fileData ? (
                  <CodeMirror
                    value={fileData.content}
                    extensions={extensions}
                    theme={isDark ? githubDark : githubLight}
                    basicSetup={{
                      lineNumbers: true,
                      foldGutter: true,
                      highlightActiveLineGutter: false,
                      highlightActiveLine: false,
                    }}
                    className="text-sm h-full"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Failed to load file
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Select a file to view</p>
              </div>
            </div>
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
