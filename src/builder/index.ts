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
 * Fluent, immutable builder for ohnet requests.
 *
 * @remarks
 * Every configuration method (`fork`, `with`, `clean`, `on`, `off`, `append`,
 * HTTP verb helpers) returns a new `OhNetBuilder` instead of mutating the
 * receiver. The original is therefore safe to share across requests - a
 * pattern suited to constructing one client per base URL and deriving
 * per-request children from it.
 *
 * When `config.adapter` is omitted, the built-in `fetchAdapter` is used. The
 * adapter is stored as a reference and never invoked at construction time, so
 * importing ohnet in environments without `globalThis.fetch` is safe; the
 * adapter itself will throw `OHNET_NO_FETCH` when it actually runs.
 *
 * @example
 * ```ts
 * const client = new OhNetBuilder({ url: "https://api.example.com" })
 *
 * const user = await client
 *   .with(authMiddleware)
 *   .get("/users/1")
 * ```
 */
export class OhNetBuilder {
  #adapter: OhNetAdapter
  #context: OhNetContext
  #middleware: OhNetMiddlewareBuilder
  #event: OhNetEventBuilder

  /**
   * @param config - Initial configuration. Only `url` and `adapter` are
   *   required to be meaningful at this stage; other fields can be supplied
   *   later via `fork` / `append` / verb helpers.
   */
  constructor(config: OhNetConfig) {
    this.#adapter = config.adapter === undefined ? fetchAdapter : config.adapter
    this.#context = createDefaultContext()
    this.#middleware = new OhNetMiddlewareBuilder()
    this.#event = new OhNetEventBuilder()
    this.applyConfig(config)
  }

  /**
   * Returns a new builder seeded with the current context, middlewares,
   * events, and adapter, then merges `config` into the child.
   *
   * @remarks
   * The child's `meta` map is reset to `{}` so middleware metadata does not
   * leak between requests. `request`, `response`, and `error` are deep-cloned
   * via {@link copyContext}; mutations on the child do not reach the parent.
   *
   * @param config - Overrides applied after the fork. Defaults to no overrides.
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
   * Alias of {@link fork} that requires a config argument.
   *
   * @remarks
   * Exists for symmetry with builder styles where `add` reads more naturally
   * than `fork` when every call provides overrides. Behavior is identical.
   */
  add(config: OhNetConfig): OhNetBuilder {
    return this.fork(config)
  }

  /**
   * Registers (or replaces) a middleware by name and returns a new builder.
   *
   * @remarks
   * The middleware's `name` is the identity used by `clean` and by replacement
   * - registering two middlewares with the same name keeps the original slot
   * and swaps the implementation.
   */
  with(middleware: OhNetMiddleware): OhNetBuilder {
    const child = this.fork()
    child.#middleware = this.#middleware.with(middleware)
    return child
  }

  /**
   * Removes every middleware with the given name from the new builder.
   *
   * @remarks
   * No-op when no middleware with that name is registered.
   */
  clean(name: string): OhNetBuilder {
    const child = this.fork()
    child.#middleware = this.#middleware.clean(name)
    return child
  }

  /**
   * Returns the middleware registry of this builder.
   *
   * @remarks
   * Useful for `builder.middleware.has` / `get` introspection. Mutations on
   * the returned registry are not propagated - only `with` / `clean` update
   * the builder's middleware list.
   */
  get middleware(): OhNetMiddlewareBuilder {
    return this.#middleware
  }

  /**
   * Registers an event handler and returns a new builder.
   *
   * @remarks
   * Use {@link OHNET_EVENT} for the canonical event names. Multiple handlers
   * on the same event fire in registration order; handler errors are
   * swallowed by the emitter and do not affect the pipeline outcome.
   */
  on(event: OhNetEventName, callback: OhNetEventHandler): OhNetBuilder {
    const child = this.fork()
    child.#event = this.#event.on(event, callback)
    return child
  }

  /**
   * Removes every handler matching the given callback reference and returns
   * a new builder.
   *
   * @remarks
   * Removal is by reference equality, not by name. Pass the same function
   * value originally supplied to {@link on}.
   */
  off(event: OhNetEventName, target: OhNetEventHandler): OhNetBuilder {
    const child = this.fork()
    child.#event = this.#event.off(event, target)
    return child
  }

  /**
   * Returns the event registry of this builder.
   *
   * @remarks
   * Use `builder.event.list(event?)` to inspect registrations. Mutating the
   * returned registry does not affect the builder.
   */
  get event(): OhNetEventBuilder {
    return this.#event
  }

  /**
   * Returns a new builder whose URL is the current URL concatenated with
   * `path`.
   *
   * @remarks
   * No separator is inserted; callers must include the leading `/` when
   * joining paths. The base URL is taken as-is - query strings are preserved.
   */
  append(path: string): OhNetBuilder {
    return this.fork({ url: this.#context.request.url + path })
  }

  /**
   * Runs the request pipeline asynchronously and resolves with the decoded
   * response body.
   *
   * @typeParam T - Expected shape of `response.data`. Defaults to `unknown`.
   *
   * @remarks
   * Internally forks the builder with `config`, appends the query string
   * from `params`, and runs the middleware + adapter pipeline. Throws:
   * - `OHNET_ABORT` if the user signal aborted before completion.
   * - `OHNET_TIMEOUT` if the request exceeded the configured timeout.
   * - `OHNET_NETWORK` for transport-level failures.
   * - `OHNET_NO_RESPONSE` when the adapter returned without setting a
   *   response and no middleware wrote one either.
   * - `OHNET_SKIPPED` when a middleware skipped and no response was provided.
   * - Any `OhNetError` a middleware assigned to `context.error`.
   */
  async request<T>(config: OhNetConfig = {}): Promise<T> {
    return this.fork(config).run<T>()
  }

  /**
   * Issues a `GET` request and resolves with the decoded body.
   *
   * @remarks
   * `params` is appended as a query string; pass `undefined` to skip.
   * `data`, when provided, is forwarded to the adapter as the request body
   * (rare for GET but supported for symmetry with other verbs).
   */
  get<T>(path?: string, params?: OhNetParams, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "GET", params, data })
  }

  /** Issues a `POST` request and resolves with the decoded body. */
  post<T>(path?: string, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "POST", data })
  }

  /** Issues a `PUT` request and resolves with the decoded body. */
  put<T>(path?: string, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "PUT", data })
  }

  /** Issues a `DELETE` request and resolves with the decoded body. */
  delete<T>(path?: string, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "DELETE", data })
  }

  /** Issues a `PATCH` request and resolves with the decoded body. */
  patch<T>(path?: string, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "PATCH", data })
  }

  /** Issues a `HEAD` request and resolves with the decoded body. */
  head<T>(path?: string, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "HEAD", data })
  }

  /** Issues an `OPTIONS` request and resolves with the decoded body. */
  options<T>(path?: string, data?: unknown): Promise<T> {
    return this.append(path ?? "").request<T>({ method: "OPTIONS", data })
  }

  /**
   * Merges a partial config into the current request, leaving undefined
   * fields untouched.
   */
  private applyConfig(config: OhNetConfig): void {
    this.#context.request = resolveRequest(this.#context.request, config)
  }

  /**
   * Final stage: resolves `params` into the URL, runs the middleware
   * pipeline through the adapter, and converts the result into a value or
   * a thrown `OhNetError`.
   *
   * @remarks
   * Resolution order for the outcome:
   * 1. `context.error` if set - rethrown as-is.
   * 2. `context.response` if set - `response.data` is returned.
   * 3. Pipeline was skipped - `OHNET_SKIPPED` is thrown.
   * 4. Otherwise - `OHNET_NO_RESPONSE` is thrown.
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
