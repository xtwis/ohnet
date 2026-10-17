import type { OhNetAdapter } from "@/adapter/types"
import type { OhNetConfig } from "@/context/types"
import type { OhNetEventHandler, OhNetEventName, OhNetMiddleware } from "@/pipeline/types"
import type { OhNetContext, OhNetParams } from "@/types"
import { fetchAdapter } from "@/adapter/fetch"
import { OhNetEventQuery } from "@/builder/event"
import { OhNetMiddlewareQuery } from "@/builder/middleware"
import { OHNET_ERROR_CODE, OHNET_ERROR_MESSAGE, OhNetInternalError } from "@/config/error"
import { resolveRequest } from "@/context/request"
import { appendQuery, buildQueryString, copyContext, createDefaultContext } from "@/context/utils"
import { compose } from "@/pipeline/dispatcher"

/**
 * @description Fluent, immutable builder for ohnet requests. Every configuration call returns a new instance.
 * @see https://x.twis.uk/en/ohnet/reference/builder.html#ohnetbuilder
 */
export class OhNetBuilder {
  #adapter: OhNetAdapter
  #context: OhNetContext
  #middlewares: OhNetMiddleware[]
  #events: Map<OhNetEventName, OhNetEventHandler[]>

  /**
   * @description Build a new {@link OhNetBuilder}. Only `url` and `adapter` are required at construction; other fields can be supplied later via `fork`, `append`, or verb helpers.
   * @see https://x.twis.uk/en/ohnet/reference/builder.html#ohnetbuilder
   */
  constructor(config: OhNetConfig) {
    this.#adapter = config.adapter === undefined ? fetchAdapter : config.adapter
    this.#context = createDefaultContext()
    this.#middlewares = []
    this.#events = new Map()
    this.applyConfig(config)
  }

  /**
   * @description Returns a new builder seeded with the current context, middlewares, events, and adapter, then merges `config` into the child. Resets `meta` to `{}`.
   * @see https://x.twis.uk/en/ohnet/reference/builder.html#ohnetbuilder
   */
  fork(config: OhNetConfig = {}): OhNetBuilder {
    const child = new OhNetBuilder({})
    child.#adapter = this.#adapter
    child.#context = copyContext(this.#context)
    child.#context.meta = {}
    child.#middlewares = [...this.#middlewares]
    child.#events = new Map()
    for (const [event, list] of this.#events) {
      child.#events.set(event, [...list])
    }
    child.applyConfig(config)
    return child
  }

  /**
   * @description Alias of {@link fork} that requires a config argument.
   * @see https://x.twis.uk/en/ohnet/reference/builder.html#ohnetbuilder
   */
  add(config: OhNetConfig): OhNetBuilder {
    return this.fork(config)
  }

  /**
   * @description Registers (or replaces) a middleware by `name` and returns a new builder. Replacement preserves the original registration index. Throws `OHNET_MIDDLEWARE_NAME` when the middleware has no non-whitespace name.
   * @see https://x.twis.uk/en/ohnet/reference/middleware.html#ohnetmiddleware
   */
  with(middleware: OhNetMiddleware): OhNetBuilder {
    const name = middleware.name
    if (typeof name !== "string" || name.trim() === "") {
      throw new OhNetInternalError(OHNET_ERROR_CODE.MIDDLEWARE_NAME, OHNET_ERROR_MESSAGE.MIDDLEWARE_NAME)
    }

    const child = this.fork()
    const index = child.#middlewares.findIndex(existing => existing.name === name)
    if (index === -1)
      child.#middlewares.push(middleware)
    else
      child.#middlewares[index] = middleware
    return child
  }

  /**
   * @description Removes every middleware with the given `name` from the new builder. No-op when none is registered.
   * @see https://x.twis.uk/en/ohnet/reference/middleware.html#ohnetmiddleware
   */
  clean(name: string): OhNetBuilder {
    const child = this.fork()
    child.#middlewares = child.#middlewares.filter(middleware => middleware.name !== name)
    return child
  }

  /**
   * @description Registers an event handler and returns a new builder. Multiple handlers on the same event fire in registration order.
   * @see https://x.twis.uk/en/ohnet/reference/middleware.html#ohneteventhandler
   */
  on(event: OhNetEventName, callback: OhNetEventHandler): OhNetBuilder {
    const child = this.fork()
    const list = [...(child.#events.get(event) ?? [])]
    list.push(callback)
    child.#events.set(event, list)
    return child
  }

  /**
   * @description Removes every handler matching the given callback reference (by identity) and returns a new builder.
   * @see https://x.twis.uk/en/ohnet/reference/middleware.html#ohneteventhandler
   */
  off(event: OhNetEventName, target: OhNetEventHandler): OhNetBuilder {
    const child = this.fork()
    const current = child.#events.get(event)
    if (!current)
      return child
    const next = current.filter(handler => handler !== target)
    if (next.length === 0)
      child.#events.delete(event)
    else
      child.#events.set(event, next)
    return child
  }

  /**
   * @description Returns a read-only query over the current middleware registry. The query is a snapshot at the time of the call; mutations on the query are not propagated back to the builder.
   * @see https://x.twis.uk/en/ohnet/reference/middleware.html#ohnetmiddleware
   */
  get middlewares(): OhNetMiddlewareQuery {
    return new OhNetMiddlewareQuery([...this.#middlewares])
  }

  /**
   * @description Returns a read-only query over the current event registry. The query is a snapshot at the time of the call; mutations on the query are not propagated back to the builder.
   * @see https://x.twis.uk/en/ohnet/reference/middleware.html#ohneteventhandler
   */
  get events(): OhNetEventQuery {
    return new OhNetEventQuery(new Map(this.#events))
  }

  /**
   * @description Returns a new builder whose URL is the current URL concatenated with `path`. Callers must include the leading `/` if needed.
   * @see https://x.twis.uk/en/ohnet/reference/builder.html#ohnetbuilder
   */
  append(path: string): OhNetBuilder {
    return this.fork({ url: this.#context.request.url + path })
  }

  /**
   * @description Runs the request pipeline and resolves with `response.data`.
   * @see https://x.twis.uk/en/ohnet/guide/builder.html
   */
  async request<T>(config: OhNetConfig = {}): Promise<T> {
    return this.fork(config).run<T>()
  }

  /**
   * @description Issues a `GET` request and resolves with the decoded body. `params` is appended as a query string; `data` is forwarded to the adapter as the body.
   * @see https://x.twis.uk/en/ohnet/guide/http.html#verbs
   */
  get<T>(path?: string, params?: OhNetParams, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "GET", params, data })
  }

  /**
   * @description Issues a `POST` request and resolves with the decoded body.
   * @see https://x.twis.uk/en/ohnet/guide/http.html#verbs
   */
  post<T>(path?: string, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "POST", data })
  }

  /**
   * @description Issues a `PUT` request and resolves with the decoded body.
   * @see https://x.twis.uk/en/ohnet/guide/http.html#verbs
   */
  put<T>(path?: string, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "PUT", data })
  }

  /**
   * @description Issues a `DELETE` request and resolves with the decoded body.
   * @see https://x.twis.uk/en/ohnet/guide/http.html#verbs
   */
  delete<T>(path?: string, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "DELETE", data })
  }

  /**
   * @description Issues a `PATCH` request and resolves with the decoded body.
   * @see https://x.twis.uk/en/ohnet/guide/http.html#verbs
   */
  patch<T>(path?: string, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "PATCH", data })
  }

  /**
   * @description Issues a `HEAD` request and resolves with the decoded body.
   * @see https://x.twis.uk/en/ohnet/guide/http.html#verbs
   */
  head<T>(path?: string, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "HEAD", data })
  }

  /**
   * @description Issues an `OPTIONS` request and resolves with the decoded body.
   * @see https://x.twis.uk/en/ohnet/guide/http.html#verbs
   */
  options<T>(path?: string, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "OPTIONS", data })
  }

  /**
   * @internal
   * @description Triggers every handler registered for `event` in registration order. Exceptions thrown by handlers are caught and discarded. Used by the pipeline dispatcher during request execution.
   */
  private emit(event: OhNetEventName): void {
    const list = this.#events.get(event)
    if (!list)
      return
    for (const handler of list) {
      try {
        handler(this.#adapter, this.#context)
      }
      catch {}
    }
  }

  /**
   * @internal
   * @description Merges a partial config into the current request, leaving undefined fields untouched.
   */
  private applyConfig(config: OhNetConfig): void {
    this.#context.request = resolveRequest(this.#context.request, config)
  }

  /**
   * @internal
   * @description Resolves `params` into the URL, runs the middleware pipeline through the adapter, and converts the result into a value or a thrown `OhNetError`.
   */
  private async run<T>(): Promise<T> {
    const { params } = this.#context.request
    if (params !== undefined) {
      this.#context.request.url = appendQuery(this.#context.request.url, buildQueryString(params))
    }

    const normal = await compose(
      this.#adapter,
      this.#context,
      this.#middlewares,
      event => this.emit(event),
    )
    if (this.#context.error) {
      throw this.#context.error
    }
    if (this.#context.response) {
      return this.#context.response.data as T
    }
    if (!normal) {
      throw new OhNetInternalError(OHNET_ERROR_CODE.SKIPPED, OHNET_ERROR_MESSAGE.SKIPPED)
    }
    throw new OhNetInternalError(OHNET_ERROR_CODE.NO_RESPONSE, OHNET_ERROR_MESSAGE.NO_RESPONSE)
  }
}
