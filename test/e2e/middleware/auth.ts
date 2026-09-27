import type { OhNetAdapter, OhNetContext, OhNetMiddlewareLeaveControls } from "@xtwis/ohnet"
import type { TokenPair } from "../storage"
import { OhNetMiddleware } from "@xtwis/ohnet"
import { AuthExpiredError, UnauthorizedError } from "../error"

function isEnvelop(value: unknown): value is { code: number, data: unknown, message: string } {
  return typeof value === "object" && value !== null
    && "code" in value && "data" in value && "message" in value
}

export interface AuthMiddlewareOptions {
  getToken: () => string | undefined
  refresh: () => Promise<TokenPair>
  onTokens: (pair: TokenPair) => void
}

export class AuthMiddleware extends OhNetMiddleware {
  readonly name = "auth"

  constructor(private readonly opts: AuthMiddlewareOptions) {
    super()
  }

  readonly enter = async (_adapter: OhNetAdapter, context: OhNetContext): Promise<void> => {
    const token = this.opts.getToken()
    if (token)
      context.request.headers.set("Authorization", `Bearer ${token}`)
  }

  readonly leave = async (
    _adapter: OhNetAdapter,
    context: OhNetContext,
    controls: OhNetMiddlewareLeaveControls,
  ): Promise<void> => {
    if (!context.response)
      return
    const body = context.response.data
    if (!isEnvelop(body) || body.code !== 401)
      return

    try {
      const newPair = await this.opts.refresh()
      this.opts.onTokens(newPair)
      controls.retry()
    }
    catch (error) {
      controls.terminate()
      if (error instanceof UnauthorizedError)
        throw error
      throw new AuthExpiredError()
    }
  }
}
