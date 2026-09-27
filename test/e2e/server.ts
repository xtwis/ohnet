import type { IncomingHttpHeaders } from "node:http"
import type { AddressInfo } from "node:net"
import { Buffer } from "node:buffer"
import http from "node:http"

export interface ApiResponse<T> {
  code: number
  data: T
  message: string
}

export interface Session {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface User {
  id: string
  name: string
  email: string
}

export interface CapturedCall {
  method: string
  url: string
  pathname: string
  headers: IncomingHttpHeaders
  body: Buffer
  at: number
}

export interface MockServer {
  readonly url: string
  readonly port: number

  readonly calls: readonly CapturedCall[]

  count: (method?: string, pathname?: string) => number

  reset: () => void

  close: () => Promise<void>
}

const DEMO_ACCESS_TOKEN = "demo-token-initial"

function generateToken(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function bearerToken(authorization: string | undefined): string | null {
  if (!authorization)
    return null
  const match = /^Bearer[ \t]+([\w.\-:]+)$/i.exec(authorization)
  return match ? match[1] : null
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader("content-type", "application/json; charset=utf-8")
  res.end(JSON.stringify(body))
}

function sendBuffer(
  res: http.ServerResponse,
  status: number,
  contentType: string,
  body: Buffer | string,
): void {
  res.statusCode = status
  res.setHeader("content-type", contentType)
  res.end(body)
}

export async function createMockServer(): Promise<MockServer> {
  const calls: CapturedCall[] = []
  const validTokens = new Set<string>([DEMO_ACCESS_TOKEN])

  function issueSession(): Session {
    const accessToken = generateToken("access")
    const refreshToken = generateToken("refresh")
    validTokens.add(accessToken)
    return { accessToken, refreshToken, expiresIn: 3600 }
  }

  const server = http.createServer(async (req, res) => {
    if (!req.url) {
      res.statusCode = 400
      res.end()
      return
    }

    const chunks: Buffer[] = []
    try {
      for await (const chunk of req)
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    catch {
      res.statusCode = 400
      res.end()
      return
    }
    const body = Buffer.concat(chunks)

    const pathname = req.url.split("?")[0] || "/"
    const method = (req.method ?? "GET").toUpperCase()

    calls.push({
      method,
      url: req.url,
      pathname,
      headers: req.headers,
      body,
      at: Date.now(),
    })

    if (method === "POST" && pathname === "/auth/login") {
      sendJson(res, 200, { code: 0, data: issueSession(), message: "ok" })
      return
    }

    if (method === "POST" && pathname === "/auth/refresh") {
      sendJson(res, 200, { code: 0, data: issueSession(), message: "ok" })
      return
    }

    if (method === "POST" && pathname === "/auth/refresh-broken") {
      sendJson(res, 200, { code: 500, data: null, message: "server error" })
      return
    }

    if (method === "POST" && pathname === "/auth/logout") {
      validTokens.clear()
      sendJson(res, 200, { code: 0, data: null, message: "ok" })
      return
    }

    if (method === "GET" && pathname === "/auth/me") {
      const token = bearerToken(req.headers.authorization)
      if (!token || !validTokens.has(token)) {
        sendJson(res, 200, { code: 401, data: null, message: "unauthorized" })
        return
      }
      sendJson(res, 200, {
        code: 0,
        data: { id: "u1", name: "Twisuki", email: "twisuki@example.com" },
        message: "ok",
      })
      return
    }

    if (method === "GET" && pathname === "/errors/404") {
      sendJson(res, 200, { code: 404, data: null, message: "not found" })
      return
    }

    if (method === "POST" && pathname === "/errors/422") {
      sendJson(res, 200, {
        code: 422,
        data: { field: "name", reason: "too long" },
        message: "validation failed",
      })
      return
    }

    if (method === "GET" && pathname === "/errors/timeout") {
      return
    }

    if (method === "GET" && pathname === "/errors/http-503") {
      sendBuffer(res, 503, "text/plain", "service unavailable")
      return
    }

    if (method === "GET" && pathname === "/errors/http-504") {
      sendBuffer(res, 504, "text/plain", "gateway timeout")
      return
    }

    if (method === "GET" && pathname === "/content/json") {
      sendJson(res, 200, { code: 0, data: { hello: "world" }, message: "ok" })
      return
    }

    if (method === "GET" && pathname === "/content/text") {
      sendBuffer(res, 200, "text/plain; charset=utf-8", "hello world")
      return
    }

    if (method === "GET" && pathname === "/content/form") {
      const payload = `code=0&data=${encodeURIComponent(JSON.stringify({ hello: "world" }))}&message=ok`
      sendBuffer(res, 200, "application/x-form-urlencoded; charset=utf-8", payload)
      return
    }

    if (method === "GET" && pathname === "/content/binary") {
      sendBuffer(res, 200, "application/octet-stream", Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]))
      return
    }

    if (method === "GET" && pathname === "/echo/headers") {
      sendJson(res, 200, { code: 0, data: req.headers, message: "ok" })
      return
    }

    if ((method === "GET" || method === "POST") && pathname === "/echo/body") {
      let parsed: unknown = null
      if (body.length > 0) {
        try {
          parsed = JSON.parse(body.toString())
        }
        catch {
          parsed = null
        }
      }
      sendJson(res, 200, { code: 0, data: { received: parsed }, message: "ok" })
      return
    }

    sendBuffer(res, 404, "text/plain", "not found")
  })

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve())
  })

  const addr = server.address() as AddressInfo

  const api: MockServer = {
    url: `http://127.0.0.1:${addr.port}`,
    port: addr.port,

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
      calls.length = 0
      validTokens.clear()
      validTokens.add(DEMO_ACCESS_TOKEN)
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
