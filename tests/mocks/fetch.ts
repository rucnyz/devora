type MockResponseConfig = {
  status?: number
  data?: unknown
  error?: string
}

type MockResponses = Record<string, MockResponseConfig>

export function createFetchMock(responses: MockResponses) {
  return async (url: string | URL | Request, options?: RequestInit): Promise<Response> => {
    const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url
    const path = urlString.replace(/^https?:\/\/[^/]+/, '').replace('/api', '')
    const method = options?.method || 'GET'
    const key = `${method}:${path}`

    // Try exact match first, then path-only match
    const mockResponse = responses[key] || responses[path]

    if (!mockResponse) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = mockResponse.error
      ? JSON.stringify({ error: mockResponse.error })
      : JSON.stringify(mockResponse.data)

    return new Response(body, {
      status: mockResponse.status || 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export function mockGlobalFetch(responses: MockResponses) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = createFetchMock(responses)
  return () => {
    globalThis.fetch = originalFetch
  }
}
