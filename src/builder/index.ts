import type { OhNetAdapter } from "@/adapter/types"
import type { OhNetConfig } from "@/context/types"
import type { OhNetEventHandler, OhNetEventName, OhNetMiddleware } from "@/pipeline/types"
import type { OhNetContext, OhNetParams } from "@/types"
import { fetchAdapter } from "@/adapter/fetch"
import { OhNetEventBuilder } from "@/builder/event"
import { OhNetMiddlewareBuilder } from "@/builder/middleware"
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
  #middleware: OhNetMiddlewareBuilder
  #event: OhNetEventBuilder

  /**
   * @description Build a new {@link OhNetBuilder}. Only `url` and `adapter` are required at construction; other fields can be supplied later via `fork`, `append`, or verb helpers.
   * @see https://x.twis.uk/en/ohnet/reference/builder.html#ohnetbuilder
   */
  constructor(config: OhNetConfig) {
    this.#adapter = config.adapter === undefined ? fetchAdapter : config.adapter
    this.#context = createDefaultContext()
    this.#middleware = new OhNetMiddlewareBuilder()
    this.#event = new OhNetEventBuilder()
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
    child.#middleware = this.#middleware.fork(this.#middleware.list())
    child.#event = this.#event.fork()
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
   * @description Registers (or replaces) a middleware by `name` and returns a new builder.
   * @see https://x.twis.uk/en/ohnet/reference/middleware.html#ohnetmiddleware
   */
  with(middleware: OhNetMiddleware): OhNetBuilder {
    const child = this.fork()
    child.#middleware = this.#middleware.with(middleware)
    return child
  }

  /**
   * @description Removes every middleware with the given `name` from the new builder. No-op when none is registered.
   * @see https://x.twis.uk/en/ohnet/reference/middleware.html#ohnetmiddleware
   */
  clean(name: string): OhNetBuilder {
    const child = this.fork()
    child.#middleware = this.#middleware.clean(name)
    return child
  }

  /**
   * @description Returns the middleware registry of this builder for introspection; mutations are not propagated.
   * @see https://x.twis.uk/en/ohnet/reference/middleware.html#ohnetmiddleware
   */
  get middleware(): OhNetMiddlewareBuilder {
    return this.#middleware
  }

  /**
   * @description Registers an event handler and returns a new builder. Multiple handlers on the same event fire in registration order.
   * @see https://x.twis.uk/en/ohnet/reference/middleware.html#ohneteventhandler
   */
  on(event: OhNetEventName, callback: OhNetEventHandler): OhNetBuilder {
    const child = this.fork()
    child.#event = this.#event.on(event, callback)
    return child
  }

  /**
   * @description Removes every handler matching the given callback reference (by identity) and returns a new builder.
   * @see https://x.twis.uk/en/ohnet/reference/middleware.html#ohneteventhandler
   */
  off(event: OhNetEventName, target: OhNetEventHandler): OhNetBuilder {
    const child = this.fork()
    child.#event = this.#event.off(event, target)
    return child
  }

  /**
   * @description Returns the event registry of this builder for introspection; mutations are not propagated.
   * @see https://x.twis.uk/en/ohnet/reference/middleware.html#ohneteventhandler
   */
  get event(): OhNetEventBuilder {
    return this.#event
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

    const normal = await compose(this.#adapter, this.#context, this.#middleware.list(), this.#event)
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
