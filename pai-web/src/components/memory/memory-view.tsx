import { useState } from 'react'
import { useMemoryList, useMemorySearch } from '@/hooks/use-memory'
import type { Memory } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, Brain, Loader2 } from 'lucide-react'

export function MemoryView() {
  const [searchQuery, setSearchQuery] = useState('')

  const { data: listData, isLoading: isListLoading } = useMemoryList()
  const { data: searchData, isLoading: isSearchLoading } = useMemorySearch(searchQuery)

  const memories = searchQuery.length > 0 ? searchData?.memories : listData?.memories
  const isLoading = searchQuery.length > 0 ? isSearchLoading : isListLoading

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
      <div className="p-3 sm:p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Memory List */}
      <ScrollArea className="flex-1">
        <div className="p-3 sm:p-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : memories && memories.length > 0 ? (
            memories.map((memory: Memory) => (
              <Card key={memory.id} className="hover:bg-muted/50 transition-colors">
                <CardHeader className="py-3 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Badge variant="secondary" className="text-xs">
                        {memory.category}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs shrink-0">
                      {new Date(memory.createdAt).toLocaleDateString('zh-TW', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="py-2 px-4">
                  <p className="text-sm line-clamp-3">{memory.content}</p>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Brain className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">
                {searchQuery ? 'No memories found' : 'No memories yet'}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
