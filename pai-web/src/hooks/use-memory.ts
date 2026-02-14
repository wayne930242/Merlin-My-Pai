import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { memoryApi } from '@/lib/api'

export function useMemoryList(category?: string) {
  return useQuery({
    queryKey: ['memories', 'list', category],
    queryFn: () => memoryApi.list(category),
  })
}

export function useMemorySearch(query: string) {
  return useQuery({
    queryKey: ['memories', 'search', query],
    queryFn: () => memoryApi.search(query),
    enabled: query.length > 0,
  })
}

export function useCreateMemory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ content, category }: { content: string; category: string }) =>
      memoryApi.create(content, category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
    },
  })
}
