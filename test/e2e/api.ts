import type { OhNetAdapter, OhNetContext } from "@xtwis/ohnet"
import type { TokenPair, TokenStorage } from "./storage"
import { OhNetBuilder, OhNetMiddleware } from "@xtwis/ohnet"
import { UnauthorizedError } from "./error"
import { AuthMiddleware } from "./middleware/auth"
import { BusinessErrorMiddleware } from "./middleware/business-error"
import { UnpackMiddleware } from "./middleware/unpack"

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

export interface ValidationDetails {
  field: string
  reason: string
}

export interface EchoBody {
  received: unknown
}

export interface ApiOptions {
  baseURL: string
  storage: TokenStorage
}

export interface Api {
  auth: {
    login: (data?: unknown) => Promise<Session>
    logout: () => Promise<null>
  }
  me: {
    get: () => Promise<User>
  }
  errors: {
    notFound: () => Promise<never>
    validation: (data?: unknown) => Promise<ValidationDetails>
  }
  content: {
    json: () => Promise<{ hello: string }>
    text: () => Promise<string>
    form: () => Promise<string>
    binary: () => Promise<ArrayBuffer>
  }
  echo: {
    headers: () => Promise<Record<string, string>>
    body: (data: unknown) => Promise<EchoBody>
  }
}

class RawAuthHeaderMiddleware extends OhNetMiddleware {
  readonly name = "raw-auth"

  constructor(private readonly getAccessToken: () => string | undefined) {
    super()
  }

  readonly enter = async (_adapter: OhNetAdapter, context: OhNetContext): Promise<void> => {
    const token = this.getAccessToken()
    if (token)
      context.request.headers.set("Authorization", `Bearer ${token}`)
  }
}

export function createApi(opts: ApiOptions): Api {
  const refreshBuilder = new OhNetBuilder({ url: opts.baseURL })
    .with(new BusinessErrorMiddleware())
    .with(new UnpackMiddleware())
    .with(new RawAuthHeaderMiddleware(() => opts.storage.get()?.accessToken))

  const auth = new AuthMiddleware({
    getToken: (): string | undefined => opts.storage.get()?.accessToken,
    refresh: async (): Promise<TokenPair> => {
      const pair = opts.storage.get()
      if (!pair)
        throw new UnauthorizedError()
      const session = await refreshBuilder.post<Session>("/auth/refresh", { refreshToken: pair.refreshToken })
      return { accessToken: session.accessToken, refreshToken: session.refreshToken }
    },
    onTokens: opts.storage.set,
  })

  const builder = new OhNetBuilder({ url: opts.baseURL })
    .with(new BusinessErrorMiddleware())
    .with(new UnpackMiddleware())
    .with(auth)

  return {
    auth: {
      login: (data?: unknown) => builder.post<Session>("/auth/login", data ?? {}),
      logout: (): Promise<null> => {
        opts.storage.clear()
        return builder.post<null>("/auth/logout")
      },
    },
    me: {
      get: () => builder.get<User>("/auth/me"),
    },
    errors: {
      notFound: () => builder.get<never>("/errors/404"),
      validation: (data?: unknown) => builder.post<ValidationDetails>("/errors/422", data ?? {}),
    },
    content: {
      json: () => builder.get<{ hello: string }>("/content/json"),
      text: () => builder.get<string>("/content/text"),
      form: () => builder.get<string>("/content/form"),
      binary: () => builder.append("/content/binary").request<ArrayBuffer>({ responseType: "arraybuffer" }),
    },
    echo: {
      headers: () => builder.get<Record<string, string>>("/echo/headers"),
      body: (data: unknown) => builder.post<EchoBody>("/echo/body", data),
    },
  }
}

export { RawAuthHeaderMiddleware }
