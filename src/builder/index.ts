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
 * @description Fluent, immutable client for ohnet requests. Every configuration call returns a new instance.
 * @see https://x.twis.uk/en/ohnet/reference/client.html#ohnetclient
 */
export class OhNetClient {
  readonly #adapter: OhNetAdapter
  readonly #context: OhNetContext
  readonly #middlewares: readonly OhNetMiddleware[]
  readonly #events: ReadonlyMap<OhNetEventName, readonly OhNetEventHandler[]>

  /**
   * @description Private 4-argument constructor invoked by {@link create} and {@link fork}. Not part of the public API.
   * @see https://x.twis.uk/en/ohnet/reference/client.html#ohnetclient
   */
  private constructor(
    adapter: OhNetAdapter,
    context: OhNetContext,
    middlewares: readonly OhNetMiddleware[],
    events: ReadonlyMap<OhNetEventName, readonly OhNetEventHandler[]>,
  ) {
    this.#adapter = adapter
    this.#context = context
    this.#middlewares = middlewares
    this.#events = events
  }

  /**
   * @description Public entry point for constructing a new {@link OhNetClient}. Computes the initial adapter and request from `config` and seeds an empty middleware/event registry.
   * @see https://x.twis.uk/en/ohnet/reference/client.html#createconfig
   */
  static create(config: OhNetConfig = {}): OhNetClient {
    const adapter = config.adapter ?? fetchAdapter
    const base = createDefaultContext()
    const context: OhNetContext = {
      ...base,
      request: resolveRequest(base.request, config),
    }
    return new OhNetClient(adapter, context, [], new Map())
  }

  /**
   * @description Returns a new client derived from this one with optional field overrides. Each omitted field is inherited from the receiver. Acts as a typed wrapper over the private 4-argument constructor.
   * @see https://x.twis.uk/en/ohnet/reference/client.html#forkoptions
   */
  fork(options: {
    adapter?: OhNetAdapter
    context?: OhNetContext
    middlewares?: readonly OhNetMiddleware[]
    events?: ReadonlyMap<OhNetEventName, readonly OhNetEventHandler[]>
  } = {}): OhNetClient {
    return new OhNetClient(
      options.adapter ?? this.#adapter,
      options.context ?? this.#context,
      options.middlewares ?? [...this.#middlewares],
      options.events ?? new Map(this.#events),
    )
  }

  /**
   * @description Merges `config` into the current request and returns a new client. The fork of the merged context is the only effect; middlewares, events, and adapter are inherited.
   * @see https://x.twis.uk/en/ohnet/reference/client.html#addconfig
   */
  add(config: OhNetConfig): OhNetClient {
    const context: OhNetContext = {
      ...copyContext(this.#context),
      request: resolveRequest(this.#context.request, config),
    }
    return this.fork({ context })
  }

  /**
   * @description Registers (or replaces) a middleware by `name` and returns a new client. Replacement preserves the original registration index. Throws `OHNET_MIDDLEWARE_NAME` when the middleware has no non-whitespace name.
   * @see https://x.twis.uk/en/ohnet/reference/client.html#withmiddleware
   */
  with(middleware: OhNetMiddleware): OhNetClient {
    const name = middleware.name
    if (typeof name !== "string" || name.trim() === "") {
      throw new OhNetInternalError(OHNET_ERROR_CODE.MIDDLEWARE_NAME, OHNET_ERROR_MESSAGE.MIDDLEWARE_NAME)
    }

    const middlewares = [...this.#middlewares]
    const index = middlewares.findIndex(existing => existing.name === name)
    if (index === -1)
      middlewares.push(middleware)
    else
      middlewares[index] = middleware
    return this.fork({ middlewares })
  }

  /**
   * @description Removes every middleware with the given `name` from the new client. No-op when none is registered.
   * @see https://x.twis.uk/en/ohnet/reference/client.html#cleanname
   */
  clean(name: string): OhNetClient {
    return this.fork({ middlewares: this.#middlewares.filter(middleware => middleware.name !== name) })
  }

  /**
   * @description Registers an event handler and returns a new client. Multiple handlers on the same event fire in registration order.
   * @see https://x.twis.uk/en/ohnet/reference/client.html#oneventcallback
   */
  on(event: OhNetEventName, callback: OhNetEventHandler): OhNetClient {
    const list = [...(this.#events.get(event) ?? []), callback]
    const events = new Map(this.#events)
    events.set(event, list)
    return this.fork({ events })
  }

  /**
   * @description Removes every handler matching the given callback reference (by identity) and returns a new client.
   * @see https://x.twis.uk/en/ohnet/reference/client.html#offeventtarget
   */
  off(event: OhNetEventName, target: OhNetEventHandler): OhNetClient {
    const current = this.#events.get(event)
    if (!current)
      return this
    const filtered = current.filter(handler => handler !== target)
    const events = new Map(this.#events)
    if (filtered.length === 0)
      events.delete(event)
    else
      events.set(event, filtered)
    return this.fork({ events })
  }

  /**
   * @description Returns a read-only query over the current middleware registry. The query is a snapshot at the time of the call; mutations on the query are not propagated back to the client.
   * @see https://x.twis.uk/en/ohnet/reference/client.html#middlewares
   */
  get middlewares(): OhNetMiddlewareQuery {
    return new OhNetMiddlewareQuery([...this.#middlewares])
  }

  /**
   * @description Returns a read-only query over the current event registry. The query is a snapshot at the time of the call; mutations on the query are not propagated back to the client.
   * @see https://x.twis.uk/en/ohnet/reference/client.html#events
   */
  get events(): OhNetEventQuery {
    return new OhNetEventQuery(new Map(this.#events))
  }

  /**
   * @description Returns a new client whose URL is the current URL concatenated with `path`. Callers must include the leading `/` if needed.
   * @see https://x.twis.uk/en/ohnet/reference/client.html#appendpath
   */
  append(path: string): OhNetClient {
    return this.add({ url: this.#context.request.url + path })
  }

  /**
   * @description Runs the request pipeline and resolves with `response.data`.
   * @see https://x.twis.uk/en/ohnet/reference/client.html#requesttconfig
   */
  async request<T>(config: OhNetConfig = {}): Promise<T> {
    return this.add(config).run<T>()
  }

  /**
   * @description Issues a `GET` request and resolves with the decoded body. `params` is appended as a query string; `data` is forwarded to the adapter as the body.
   * @see https://x.twis.uk/en/ohnet/reference/client.html#http-verbs
   */
  get<T>(path?: string, params?: OhNetParams, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "GET", params, data })
  }

  /**
   * @description Issues a `POST` request and resolves with the decoded body.
   * @see https://x.twis.uk/en/ohnet/reference/client.html#http-verbs
   */
  post<T>(path?: string, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "POST", data })
  }

  /**
   * @description Issues a `PUT` request and resolves with the decoded body.
   * @see https://x.twis.uk/en/ohnet/reference/client.html#http-verbs
   */
  put<T>(path?: string, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "PUT", data })
  }

  /**
   * @description Issues a `DELETE` request and resolves with the decoded body.
   * @see https://x.twis.uk/en/ohnet/reference/client.html#http-verbs
   */
  delete<T>(path?: string, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "DELETE", data })
  }

  /**
   * @description Issues a `PATCH` request and resolves with the decoded body.
   * @see https://x.twis.uk/en/ohnet/reference/client.html#http-verbs
   */
  patch<T>(path?: string, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "PATCH", data })
  }

  /**
   * @description Issues a `HEAD` request and resolves with the decoded body.
   * @see https://x.twis.uk/en/ohnet/reference/client.html#http-verbs
   */
  head<T>(path?: string, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "HEAD", data })
  }

  /**
   * @description Issues an `OPTIONS` request and resolves with the decoded body.
   * @see https://x.twis.uk/en/ohnet/reference/client.html#http-verbs
   */
  options<T>(path?: string, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "OPTIONS", data })
  }

  /**
   * @internal
   * @description Triggers every handler registered for `event` in registration order. Exceptions thrown by handlers are caught and discarded. Receives `context` from the dispatcher and invokes each handler with `this.#adapter` and the passed `context`.
   */
  private emit(event: OhNetEventName, context: OhNetContext): void {
    const list = this.#events.get(event)
    if (!list)
      return
    for (const handler of list) {
      try {
        handler(this.#adapter, context)
      }
      catch {}
    }
  }

  /**
   * @internal
   * @description Resolves `params` into the URL, runs the middleware pipeline through the adapter, and converts the result into a value or a thrown `OhNetError`.
   */
  private async run<T>(): Promise<T> {
    const { params } = this.#context.request
    const context = copyContext(this.#context)
    if (params !== undefined) {
      context.request = {
        ...context.request,
        url: appendQuery(context.request.url, buildQueryString(params)),
      }
    }

    const normal = await compose(
      this.#adapter,
      context,
      [...this.#middlewares],
      (event, context) => this.emit(event, context),
    )
    if (context.error) {
      throw context.error
    }
    if (context.response) {
      return context.response.data as T
    }
    if (!normal) {
      throw new OhNetInternalError(OHNET_ERROR_CODE.SKIPPED, OHNET_ERROR_MESSAGE.SKIPPED)
    }
    throw new OhNetInternalError(OHNET_ERROR_CODE.NO_RESPONSE, OHNET_ERROR_MESSAGE.NO_RESPONSE)
  }
}
