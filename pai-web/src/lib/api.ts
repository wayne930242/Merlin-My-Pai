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
  category: string
  content: string
  importance?: number
  createdAt?: string
}

export interface MemoryListResponse {
  memories: Memory[]
  total: number
}

// Memory API functions
export const memoryApi = {
  list: (category?: string, limit = 20) =>
    apiFetch<MemoryListResponse>('/api/memory/list', {
      params: { limit: String(limit), ...(category && { category }) },
    }),

  search: (query: string, limit = 10) =>
    apiFetch<{ ok: boolean; count: number; memories: Memory[] }>('/api/memory/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    }),

  create: (content: string, category: string, importance = 1) =>
    apiFetch<{ ok: boolean; id?: number; duplicate?: boolean }>('/api/memory/save', {
      method: 'POST',
      body: JSON.stringify({ content, category, importance }),
    }),

  stats: () =>
    apiFetch<{ total: number; limit: number; usage: string }>('/api/memory/stats'),
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

// Workspace API types
export interface WorkspaceEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: string | null
}

export interface WorkspaceFile {
  content: string
  path: string
  size: number
  modified: string
}

// Workspace API functions
export const workspaceApi = {
  list: (path: string = '') =>
    apiFetch<{ items: WorkspaceEntry[]; currentPath: string }>('/api/workspace/list', {
      params: path ? { path } : {},
    }),

  read: (path: string) =>
    apiFetch<WorkspaceFile>('/api/workspace/read', {
      params: { path },
    }),
}

// RAG API types
export interface RagStats {
  total_chunks: number
  total_files: number
  db_path: string
  embedding: string
}

export interface RagDocument {
  file_path: string
  chunk?: string
  distance: number
}

export interface RagQueryResult {
  question: string
  answer: string
  documents: RagDocument[]
  retry_count: number
}

export interface RagSyncResult {
  added: number
  updated: number
  deleted: number
  unchanged: number
}

// RAG API functions
export const ragApi = {
  stats: () => apiFetch<RagStats>('/api/rag/stats'),

  query: (question: string, maxRetries = 2) =>
    apiFetch<RagQueryResult>('/api/rag/query', {
      method: 'POST',
      body: JSON.stringify({ question, max_retries: maxRetries }),
    }),

  search: (query: string, topK = 5) =>
    apiFetch<{ results: RagDocument[] }>('/api/rag/search', {
      method: 'POST',
      body: JSON.stringify({ query, top_k: topK }),
    }),

  sync: () =>
    apiFetch<RagSyncResult>('/api/rag/sync', {
      method: 'POST',
    }),
}
