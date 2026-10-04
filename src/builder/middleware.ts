import type { OhNetMiddleware } from "@/pipeline/types"
import { OHNET_ERROR_CODE, OHNET_ERROR_MESSAGE, OhNetInternalError } from "@/config/error"

/**
 * @internal
 * @description Internal registry of middlewares used by {@link OhNetBuilder.middleware}. Reachable from outside only through `builder.middleware` or `builder.with` / `builder.clean`. Methods return new instances.
 */
export class OhNetMiddlewareBuilder {
  #middlewares: OhNetMiddleware[]

  constructor() {
    this.#middlewares = []
  }

  /**
   * @description Returns a new registry seeded with the given middlewares. The array is shallow-copied.
   */
  fork(middlewares: OhNetMiddleware[]): OhNetMiddlewareBuilder {
    const child = new OhNetMiddlewareBuilder()
    child.#middlewares = [...middlewares]
    return child
  }

  /**
   * @description Returns a snapshot of the registered middlewares in execution order.
   */
  list(): OhNetMiddleware[] {
    return this.#middlewares.slice()
  }

  /**
   * @description Returns whether a middleware with the given name is registered.
   */
  has(name: string): boolean {
    return this.#middlewares.some(middleware => middleware.name === name)
  }

  /**
   * @description Returns the first middleware with the given name, or `undefined` when none.
   */
  get(name: string): OhNetMiddleware | undefined {
    return this.#middlewares.find(middleware => middleware.name === name)
  }

  /**
   * @description Adds a middleware, or replaces an existing one with the same name. Replacement preserves the original registration index. Throws `OHNET_MIDDLEWARE_NAME` when the middleware has no non-whitespace name.
   */
  with(middleware: OhNetMiddleware): OhNetMiddlewareBuilder {
    const name = middleware.name
    if (typeof name !== "string" || name.trim() === "") {
      throw new OhNetInternalError(OHNET_ERROR_CODE.MIDDLEWARE_NAME, OHNET_ERROR_MESSAGE.MIDDLEWARE_NAME)
    }

    const next = [...this.#middlewares]
    const index = next.findIndex(existing => existing.name === name)
    if (index === -1)
      next.push(middleware)
    else
      next[index] = middleware
    return this.fork(next)
  }

  /**
   * @description Removes every middleware with the given name and returns a new registry. No-op when none is registered.
   */
  clean(name: string): OhNetMiddlewareBuilder {
    const next = this.#middlewares.filter(middleware => middleware.name !== name)
    return this.fork(next)
  }
}
