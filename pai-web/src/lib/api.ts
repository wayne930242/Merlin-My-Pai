/**
 * API Client for pai-bot
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const API_KEY = import.meta.env.VITE_API_KEY || ''

interface FetchOptions extends RequestInit {
  params?: Record<string, string>
}

/**
 * Fetch with authentication and error handling
 */
export async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { params, ...init } = options

  // Build URL with query params
  const url = new URL(endpoint, API_BASE_URL)
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })
  }

  // Add auth header
  const headers = new Headers(init.headers)
  if (API_KEY) {
    headers.set('Authorization', `Bearer ${API_KEY}`)
  }
  headers.set('Content-Type', 'application/json')

  const response = await fetch(url.toString(), {
    ...init,
    headers,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || `HTTP ${response.status}`)
  }

  return response.json()
}

// Memory API types
export interface Memory {
  id: number
  userId: number
  category: string
  content: string
  source: string
  createdAt: string
}

export interface MemoryListResponse {
  memories: Memory[]
  total: number
}

// Memory API functions
export const memoryApi = {
  list: (userId: number, category?: string) =>
    apiFetch<MemoryListResponse>('/api/memory/list', {
      params: { userId: String(userId), ...(category && { category }) },
    }),

  search: (userId: number, query: string, limit = 10) =>
    apiFetch<{ memories: Memory[] }>('/api/memory/search', {
      params: { userId: String(userId), query, limit: String(limit) },
    }),

  create: (userId: number, content: string, category: string, source = 'web') =>
    apiFetch<Memory>('/api/memory/save', {
      method: 'POST',
      body: JSON.stringify({ userId, content, category, source }),
    }),
}

// History API types
export type HistoryType = 'sessions' | 'learnings' | 'decisions'

export interface HistoryEntry {
  filename: string
  type: HistoryType
  summary?: string
  date: string
}

// History API functions
export const historyApi = {
  list: (type: string = 'all', limit = 20) =>
    apiFetch<{ items: HistoryEntry[] }>('/api/history/list', {
      params: { type, limit: String(limit) },
    }),

  search: (query: string, type: string = 'all', limit = 10) =>
    apiFetch<{ items: HistoryEntry[] }>('/api/history/search', {
      params: { query, type, limit: String(limit) },
    }),

  read: (type: HistoryType, filename: string) =>
    apiFetch<{ content: string }>(`/api/history/read/${type}/${filename}`),
}
