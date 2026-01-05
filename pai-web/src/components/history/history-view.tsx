import { useState } from 'react'
import { useHistoryList, useHistorySearch, useHistoryContent } from '@/hooks/use-history'
import type { HistoryType, HistoryEntry } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Search, History, FileText, Lightbulb, GitBranch, Loader2, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

const TYPE_ICONS: Record<HistoryType, typeof History> = {
  sessions: FileText,
  learnings: Lightbulb,
  decisions: GitBranch,
}

const TYPE_LABELS: Record<HistoryType, string> = {
  sessions: 'Sessions',
  learnings: 'Learnings',
  decisions: 'Decisions',
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'sessions', label: 'Sessions' },
  { value: 'learnings', label: 'Learnings' },
  { value: 'decisions', label: 'Decisions' },
] as const

export function HistoryView() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null)

  const { data: listData, isLoading: isListLoading } = useHistoryList(selectedType)
  const { data: searchData, isLoading: isSearchLoading } = useHistorySearch(
    searchQuery,
    selectedType
  )
  const { data: contentData, isLoading: isContentLoading } = useHistoryContent(
    selectedEntry?.type ?? 'sessions',
    selectedEntry?.filename ?? ''
  )

  const entries = searchQuery.length > 0 ? searchData?.items : listData?.items
  const isLoading = searchQuery.length > 0 ? isSearchLoading : isListLoading

  // Content view
  if (selectedEntry) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 sm:p-4 border-b flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedEntry(null)}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {(() => {
              const Icon = TYPE_ICONS[selectedEntry.type]
              return <Icon className="h-4 w-4 shrink-0" />
            })()}
            <span className="text-sm font-medium truncate">
              {selectedEntry.filename.replace(/\.md$/, '').replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4">
            {isContentLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : contentData?.content ? (
              <pre className="text-sm whitespace-pre-wrap font-mono bg-muted/50 p-4 rounded-lg overflow-x-auto">
                {contentData.content}
              </pre>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Unable to load content
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

  // List view
  return (
    <div className="flex flex-col h-full">
      {/* Search & Filter Bar */}
      <div className="p-3 sm:p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-1 overflow-x-auto pb-1">
          {FILTER_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={selectedType === option.value ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSelectedType(option.value)}
              className={cn(
                'shrink-0 text-xs',
                selectedType === option.value && 'bg-secondary'
              )}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {/* History List */}
      <ScrollArea className="flex-1">
        <div className="p-3 sm:p-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries && entries.length > 0 ? (
            entries.map((entry) => {
              const Icon = TYPE_ICONS[entry.type]
              return (
                <Card
                  key={`${entry.type}-${entry.filename}`}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedEntry(entry)}
                >
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Badge variant="outline" className="text-xs">
                          {TYPE_LABELS[entry.type]}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs shrink-0">
                        {entry.date}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="py-2 px-4">
                    <CardTitle className="text-sm font-medium mb-1 line-clamp-1">
                      {entry.filename.replace(/\.md$/, '').replace(/_/g, ' ')}
                    </CardTitle>
                    {entry.summary && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {entry.summary}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">
                {searchQuery ? 'No history found' : 'No history entries yet'}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
