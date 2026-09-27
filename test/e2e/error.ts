import { OhNetError } from "@xtwis/ohnet"

export class BusinessError extends OhNetError {
  constructor(code: number, message: string, data?: unknown) {
    super("BUSINESS", String(code), message, data)
  }
}

export class UnauthorizedError extends BusinessError {
  constructor(data?: unknown) {
    super(401, "unauthorized", data)
  }
}

export class NotFoundError extends BusinessError {
  constructor(data?: unknown) {
    super(404, "not found", data)
  }
}

export class ValidationError extends BusinessError {
  constructor(data?: unknown) {
    super(422, "validation failed", data)
  }
}

export class ServerError extends BusinessError {
  constructor(data?: unknown) {
    super(500, "server error", data)
  }
}

export class AuthExpiredError extends OhNetError {
  constructor() {
    super("AUTH", "AUTH_EXPIRED", "auth refresh failed")
  }
}
