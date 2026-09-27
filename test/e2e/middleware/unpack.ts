import type { OhNetAdapter, OhNetContext } from "@xtwis/ohnet"
import { OhNetMiddleware } from "@xtwis/ohnet"

function isEnvelop(value: unknown): value is { code: number, data: unknown, message: string } {
  return typeof value === "object" && value !== null
    && "code" in value && "data" in value && "message" in value
}

export class UnpackMiddleware extends OhNetMiddleware {
  readonly name = "unpack"

  readonly leave = async (_adapter: OhNetAdapter, context: OhNetContext): Promise<void> => {
    if (!context.response)
      return
    const body = context.response.data
    if (!isEnvelop(body) || body.code !== 0)
      return
    context.response.data = body.data
  }
}
