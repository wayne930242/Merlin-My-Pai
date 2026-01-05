import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { memoryApi } from '@/lib/api'

const USER_ID = 1 // TODO: get from auth context

export function useMemoryList(category?: string) {
  return useQuery({
    queryKey: ['memories', USER_ID, category],
    queryFn: () => memoryApi.list(USER_ID, category),
  })
}

export function useMemorySearch(query: string) {
  return useQuery({
    queryKey: ['memories', 'search', USER_ID, query],
    queryFn: () => memoryApi.search(USER_ID, query),
    enabled: query.length > 0,
  })
}

export function useCreateMemory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ content, category }: { content: string; category: string }) =>
      memoryApi.create(USER_ID, content, category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memories'] })
    },
  })
}
