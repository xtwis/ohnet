import type { OhNetMiddleware } from "@/pipeline/types"

/**
 * @description Read-only query over a builder's middleware registry. Returned by {@link OhNetBuilder.middlewares} for introspection. Each call returns a fresh snapshot of the builder's current state; mutations on the query are not propagated back to the builder.
 * @see https://x.twis.uk/en/ohnet/reference/middleware.html#ohnetmiddleware
 */
export class OhNetMiddlewareQuery {
  readonly #middlewares: readonly OhNetMiddleware[]

  constructor(middlewares: readonly OhNetMiddleware[]) {
    this.#middlewares = middlewares
  }

  /**
   * @description Returns the first middleware with the given name, or `undefined` when none is registered.
   */
  get(name: string): OhNetMiddleware | undefined {
    return this.#middlewares.find(middleware => middleware.name === name)
  }

  /**
   * @description Returns whether a middleware with the given name is registered.
   */
  has(name: string): boolean {
    return this.#middlewares.some(middleware => middleware.name === name)
  }

  /**
   * @description Returns a snapshot of the registered middlewares in execution order.
   */
  list(): readonly OhNetMiddleware[] {
    return [...this.#middlewares]
  }
}
