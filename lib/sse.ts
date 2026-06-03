export type SseEvent = { type: string; data: unknown }

const clients = new Set<ReadableStreamDefaultController<Uint8Array>>()

export function broadcastEvent(event: SseEvent) {
  const message = `data: ${JSON.stringify(event)}\n\n`
  const bytes = new TextEncoder().encode(message)

  for (const controller of clients) {
    try {
      controller.enqueue(bytes)
    } catch {
      clients.delete(controller)
    }
  }
}

export function createSseResponse(request: Request) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      clients.add(controller)

      const welcomeMessage = `data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`
      controller.enqueue(new TextEncoder().encode(welcomeMessage))

      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat = `data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`
          controller.enqueue(new TextEncoder().encode(heartbeat))
        } catch {
          clearInterval(heartbeatInterval)
          clients.delete(controller)
        }
      }, 30000)

      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeatInterval)
        clients.delete(controller)
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
