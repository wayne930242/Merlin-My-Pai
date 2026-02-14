import { afterEach, expect, mock, test } from 'bun:test'

import { memoryApi } from '@/lib/api'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('memoryApi.search sends POST body with query and limit', async () => {
  const fetchMock = mock(async () =>
    new Response(JSON.stringify({ ok: true, count: 0, memories: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  )
  globalThis.fetch = fetchMock as typeof fetch

  await memoryApi.search('bun', 5)

  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(init.method).toBe('POST')
  const body = JSON.parse(String(init.body)) as { query: string; limit: number }
  expect(body.query).toBe('bun')
  expect(body.limit).toBe(5)
})

test('memoryApi.create sends capability-compatible payload', async () => {
  const fetchMock = mock(async () =>
    new Response(JSON.stringify({ ok: true, id: 1 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  )
  globalThis.fetch = fetchMock as typeof fetch

  await memoryApi.create('Use Bun', 'preference')

  const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(init.method).toBe('POST')
  const body = JSON.parse(String(init.body)) as { content: string; category: string; importance: number }
  expect(body).toEqual({ content: 'Use Bun', category: 'preference', importance: 1 })
})
