import type { OhNetAdapter } from "@xtwis/ohnet"
import type { Api, Session } from "./api"
import type { MockServer } from "./server"
import type { TokenStorage } from "./storage"
import { OhNetBuilder } from "@xtwis/ohnet"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { createApi } from "./api"
import { AuthExpiredError, NotFoundError, UnauthorizedError, ValidationError } from "./error"
import { AuthMiddleware } from "./middleware/auth"
import { BusinessErrorMiddleware } from "./middleware/business-error"
import { UnpackMiddleware } from "./middleware/unpack"
import { createMockServer } from "./server"
import { createTokenStorage } from "./storage"

describe("e2e - api integration", () => {
  let server: MockServer
  let storage: TokenStorage
  let api: Api

  beforeAll(async () => {
    server = await createMockServer()
  })

  beforeEach(() => {
    server.reset()
    storage = createTokenStorage({
      accessToken: "demo-token-initial",
      refreshToken: "demo-refresh-initial",
    })
    api = createApi({ baseURL: server.url, storage })
  })

  afterAll(async () => {
    await server.close()
  })

  describe("auth group", () => {
    it("returns a session with both tokens from login", async () => {
      const session = await api.auth.login()

      expect(session.accessToken).toBeTruthy()
      expect(session.refreshToken).toBeTruthy()
      expect(session.expiresIn).toBe(3600)
    })

    it("returns the demo user from me with the seeded token", async () => {
      const user = await api.me.get()

      expect(user.id).toBe("u1")
      expect(user.name).toBe("Twisuki")
    })

    it("rejects me with UnauthorizedError after logout invalidates the token", async () => {
      await api.auth.logout()

      await expect(api.me.get()).rejects.toBeInstanceOf(UnauthorizedError)
    })
  })

  describe("auto refresh", () => {
    it("silently refreshes the token and retries after a 401", async () => {
      storage.set({ accessToken: "stale-access", refreshToken: "stale-refresh" })

      const user = await api.me.get()

      expect(user.id).toBe("u1")
      const after = storage.get()
      expect(after?.accessToken).not.toBe("stale-access")
      expect(after?.refreshToken).not.toBe("stale-refresh")
      expect(server.count("GET", "/auth/me")).toBe(2)
      expect(server.count("POST", "/auth/refresh")).toBe(1)
    })

    it("throws AuthExpiredError when refresh itself fails", async () => {
      storage.set({ accessToken: "stale-access", refreshToken: "stale-refresh" })
      const builder = buildBrokenApi({ baseURL: server.url, storage })

      await expect(builder.get("/auth/me")).rejects.toBeInstanceOf(AuthExpiredError)
    })
  })

  describe("business errors", () => {
    it("throws NotFoundError with response reachable via data on code 404", async () => {
      try {
        await api.errors.notFound()
        throw new Error("should not reach")
      }
      catch (error) {
        expect(error).toBeInstanceOf(NotFoundError)
        const response = (error as NotFoundError).data as { status: number, data: { code: number } }
        expect(response.status).toBe(200)
        expect(response.data.code).toBe(404)
      }
    })

    it("exposes validation details through response.data.data on code 422", async () => {
      try {
        await api.errors.validation()
        throw new Error("should not reach")
      }
      catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        const response = (error as ValidationError).data as { data: { data: { field: string, reason: string } } }
        expect(response.data.data.field).toBe("name")
        expect(response.data.data.reason).toBe("too long")
      }
    })
  })

  describe("response content variants", () => {
    it("decodes application/json into an object via unpack", async () => {
      const data = await api.content.json()

      expect(data.hello).toBe("world")
    })

    it("decodes text/plain into a string", async () => {
      const text = await api.content.text()

      expect(text).toBe("hello world")
    })

    it("returns the form-urlencoded payload as a string", async () => {
      const form = await api.content.form()

      expect(form).toContain("code=0")
      expect(form).toContain("message=ok")
    })

    it("decodes application/octet-stream into an ArrayBuffer", async () => {
      const buffer = await api.content.binary()

      expect(buffer).toBeInstanceOf(ArrayBuffer)
      const bytes = new Uint8Array(buffer)
      expect(bytes.length).toBe(5)
      expect(Array.from(bytes)).toEqual([0x00, 0x01, 0x02, 0x03, 0x04])
    })
  })

  describe("echo helpers", () => {
    it("includes the Authorization header on authed requests", async () => {
      const headers = await api.echo.headers()

      const auth = headers.authorization ?? headers.Authorization
      expect(auth).toBe("Bearer demo-token-initial")
    })

    it("echoes the request body for POST endpoints", async () => {
      const echoed = await api.echo.body({ hello: "world", n: 1 })

      expect(echoed.received).toEqual({ hello: "world", n: 1 })
    })
  })
})

interface BrokenApiOptions {
  baseURL: string
  storage: TokenStorage
  adapter?: OhNetAdapter
}

function buildBrokenApi(opts: BrokenApiOptions): OhNetBuilder {
  const refreshBuilder = new OhNetBuilder({ url: opts.baseURL })
    .with(new BusinessErrorMiddleware())
    .with(new UnpackMiddleware())

  const auth = new AuthMiddleware({
    getToken: (): string | undefined => opts.storage.get()?.accessToken,
    refresh: async (): Promise<{ accessToken: string, refreshToken: string }> => {
      const pair = opts.storage.get()
      if (!pair)
        throw new UnauthorizedError()
      const session = await refreshBuilder.post<Session>("/auth/refresh-broken", { refreshToken: pair.refreshToken })
      return { accessToken: session.accessToken, refreshToken: session.refreshToken }
    },
    onTokens: opts.storage.set,
  })

  const builder = new OhNetBuilder({ url: opts.baseURL, adapter: opts.adapter })
    .with(new BusinessErrorMiddleware())
    .with(new UnpackMiddleware())
    .with(auth)
  return builder
}
