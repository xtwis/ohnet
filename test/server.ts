import type { IncomingHttpHeaders } from "node:http"
import type { AddressInfo } from "node:net"
import { Buffer } from "node:buffer"
import http from "node:http"

export interface CapturedCall {
  method: string
  url: string
  pathname: string
  headers: IncomingHttpHeaders
  body: Buffer
  at: number
}

export interface RouteResponse {
  status?: number
  headers?: Record<string, string | string[]>
  body?: string | Buffer
  delay?: number
  hang?: boolean
  close?: boolean
}

export type RouteHandler = (callIndex: number, call: CapturedCall) => RouteResponse | Promise<RouteResponse>

interface InternalRoute {
  method: string
  pathname: string
  handler: RouteHandler
}

export interface TestServer {
  readonly url: string
  readonly port: number

  route: (method: string, pathname: string, handler: RouteHandler) => this
  reply: (method: string, pathname: string, body: string | Buffer, init?: {
    status?: number
    headers?: Record<string, string | string[]>
  }) => this
  hang: (method: string, pathname: string) => this
  kill: (method: string, pathname: string) => this

  readonly calls: readonly CapturedCall[]

  count: (method?: string, pathname?: string) => number

  reset: () => void

  close: () => Promise<void>
}

export async function createTestServer(): Promise<TestServer> {
  const calls: CapturedCall[] = []
  const routes: InternalRoute[] = []
  const callCounters = new Map<string, number>()

  function nextCallIndex(method: string, pathname: string): number {
    const key = `${method} ${pathname}`
    const next = (callCounters.get(key) ?? 0) + 1
    callCounters.set(key, next)
    return next
  }

  function findRoute(method: string, pathname: string): InternalRoute | undefined {
    return routes.find(r => r.method === method && r.pathname === pathname)
  }

  const server = http.createServer(async (req, res) => {
    if (!req.url)
      return

    const chunks: Buffer[] = []
    try {
      for await (const chunk of req)
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    catch {
      return
    }
    const body = Buffer.concat(chunks)

    const rawUrl = req.url
    const pathname = rawUrl.split("?")[0] || "/"
    const method = (req.method ?? "GET").toUpperCase()

    const call: CapturedCall = {
      method,
      url: rawUrl,
      pathname,
      headers: req.headers,
      body,
      at: Date.now(),
    }
    calls.push(call)

    let result: RouteResponse = { status: 404, body: "not found" }
    const route = findRoute(method, pathname)
    if (route) {
      try {
        result = await route.handler(nextCallIndex(method, pathname), call)
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error("[test-server] handler threw:", error)
        result = { status: 500, body: `route handler error: ${message}` }
      }
    }

    if (result.close) {
      req.socket.destroy()
      return
    }

    if (result.hang) {
      return
    }

    const writeResponse = (): void => {
      res.statusCode = result.status ?? 200
      if (result.headers) {
        for (const [name, value] of Object.entries(result.headers)) {
          try {
            res.setHeader(name, value)
          }
          catch {}
        }
      }
      if (result.body !== undefined)
        res.end(result.body)
      else
        res.end()
    }

    const delay = result.delay ?? 0
    if (delay > 0) {
      const timer = setTimeout(writeResponse, delay)
      timer.unref()
      req.once("close", () => clearTimeout(timer))
    }
    else {
      writeResponse()
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve())
  })

  const addr = server.address() as AddressInfo

  const api: TestServer = {
    url: `http://127.0.0.1:${addr.port}`,
    port: addr.port,

    route(method, pathname, handler) {
      routes.push({ method: method.toUpperCase(), pathname, handler })
      return api
    },

    reply(method, pathname, body, init = {}) {
      routes.push({
        method: method.toUpperCase(),
        pathname,
        handler: () => ({
          status: init.status ?? 200,
          headers: init.headers,
          body,
        }),
      })
      return api
    },

    hang(method, pathname) {
      routes.push({
        method: method.toUpperCase(),
        pathname,
        handler: () => ({ hang: true }),
      })
      return api
    },

    kill(method, pathname) {
      routes.push({
        method: method.toUpperCase(),
        pathname,
        handler: () => ({ close: true }),
      })
      return api
    },

    get calls() {
      return calls.slice()
    },

    count(method, pathname) {
      const m = method?.toUpperCase()
      return calls.filter((c) => {
        if (m && c.method !== m)
          return false
        if (pathname && c.pathname !== pathname)
          return false
        return true
      }).length
    },

    reset() {
      routes.length = 0
      calls.length = 0
      callCounters.clear()
    },

    async close() {
      server.closeAllConnections?.()
      await new Promise<void>((resolve, reject) => {
        server.close(err => err ? reject(err) : resolve())
      })
    },
  }

  return api
}
