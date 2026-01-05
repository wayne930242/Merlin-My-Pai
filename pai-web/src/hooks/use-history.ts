import { useQuery } from '@tanstack/react-query'
import { historyApi, type HistoryType } from '@/lib/api'

export function useHistoryList(type: string = 'all', limit = 20) {
  return useQuery({
    queryKey: ['history', 'list', type, limit],
    queryFn: () => historyApi.list(type, limit),
  })
}

export function useHistorySearch(query: string, type: string = 'all', limit = 10) {
  return useQuery({
    queryKey: ['history', 'search', query, type, limit],
    queryFn: () => historyApi.search(query, type, limit),
    enabled: query.length > 0,
  })
}

export function useHistoryContent(type: HistoryType, filename: string) {
  return useQuery({
    queryKey: ['history', 'content', type, filename],
    queryFn: () => historyApi.read(type, filename),
    enabled: !!type && !!filename,
  })
}
