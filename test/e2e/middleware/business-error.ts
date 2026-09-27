import type { OhNetAdapter, OhNetContext, OhNetMiddlewareLeaveControls } from "@xtwis/ohnet"
import { OhNetMiddleware } from "@xtwis/ohnet"
import { BusinessError, NotFoundError, ServerError, UnauthorizedError, ValidationError } from "../error"

const DEFAULT_MAP: Record<number, new (data?: unknown) => BusinessError> = {
  401: UnauthorizedError,
  404: NotFoundError,
  422: ValidationError,
  500: ServerError,
}

function isEnvelop(value: unknown): value is { code: number, data: unknown, message: string } {
  return typeof value === "object" && value !== null
    && "code" in value && "data" in value && "message" in value
}

export class BusinessErrorMiddleware extends OhNetMiddleware {
  readonly name = "business-error"

  constructor(
    private readonly map: Record<number, new (data?: unknown) => BusinessError> = DEFAULT_MAP,
  ) {
    super()
  }

  readonly leave = async (
    _adapter: OhNetAdapter,
    context: OhNetContext,
    controls: OhNetMiddlewareLeaveControls,
  ): Promise<void> => {
    if (!context.response)
      return
    const body = context.response.data
    if (!isEnvelop(body) || body.code === 0)
      return
    const ErrorClass = this.map[body.code] ?? BusinessError
    controls.terminate()
    throw new ErrorClass(context.response)
  }
}
