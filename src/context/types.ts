import type { OhNetAdapter } from "@/adapter/types"
import type { OhNetHeaderLike } from "@/model/header"
import type { OhNetSignal } from "@/model/signal"
import type { OhNetMethod, OhNetParams, OhNetResponseKind, OhNetResponseType } from "@/types"

/**
 * Partial request configuration used to override a builder's current state.
 *
 * @remarks
 * Every field is optional. {@link resolveRequest} merges a partial config
 * into an existing `OhNetRequest`, leaving undefined fields untouched.
 * Builders accept this shape on the constructor, `fork` / `add`,
 * `request`, and the HTTP verb helpers.
 */
export interface OhNetRequestConfig {
  /** Target URL. Replaces the builder's current URL. */
  url?: string
  /** HTTP method. Replaces the builder's current method. */
  method?: OhNetMethod
  /** Headers to merge on top of the existing collection (right-side wins per name). */
  headers?: OhNetHeaderLike
  /** Query string source. Replaces any previously configured `params`. */
  params?: OhNetParams
  /** Request body. Forwarded to the adapter as-is. */
  data?: unknown
  /** External abort signal. Forwarded to the adapter's transport. */
  signal?: OhNetSignal
  /** Timeout in milliseconds. `undefined` disables the timeout. */
  timeout?: number
  /** Maximum middleware-driven retries per request. Defaults to `1`. */
  middlewareRetries?: number
  /** Adapter-level auto-retry signal; passed to the adapter verbatim, semantics adapter-defined. */
  autoRetries?: boolean | number
  /** Body decoding strategy for the adapter. */
  responseType?: OhNetResponseType
}

/**
 * Loose response shape produced by adapters and consumed by {@link createResponse}.
 *
 * @remarks
 * Lets adapters return responses that mirror their underlying transport
 * without first wrapping them in {@link OhNetResponse}. Fields that
 * {@link createResponse} can synthesize (`statusText`, `ok`, `redirected`,
 * `type`) are optional; the rest must be supplied.
 *
 * @typeParam T - Type of the decoded `data` payload. Defaults to `unknown`.
 */
export interface OhNetResponseLike<T = unknown> {
  /** HTTP status code. Required. */
  status: number
  /** Response headers. Required; normalized through `OhNetHeader`. */
  headers: OhNetHeaderLike
  /** Final URL after redirects. Required. */
  url: string
  /** HTTP status text. Defaults to an empty string when omitted. */
  statusText?: string
  /** Whether the response is considered successful. Defaults to `status` in 200-299 when omitted. */
  ok?: boolean
  /** True when the response came from at least one redirect. Defaults to `false`. */
  redirected?: boolean
  /** Response classification, mirroring the Fetch specification. Defaults to `"default"`. */
  type?: OhNetResponseKind
  /** Decoded body. Type is determined by `T` and the request's `responseType`. */
  data?: T
  /** Raw transport object when the adapter wants to expose it (e.g. `"raw"` mode). */
  body?: unknown
}

/**
 * Top-level configuration passed to `new OhNetBuilder(config)`.
 *
 * @remarks
 * Same fields as {@link OhNetRequestConfig} with the addition of an
 * optional transport. When `adapter` is omitted, the built-in
 * `fetchAdapter` is used.
 */
export interface OhNetConfig extends OhNetRequestConfig {
  /**
   * Transport implementation. Stored on the builder and invoked
   * once per request; the same adapter is shared across every forked
   * child. Defaults to the built-in `fetchAdapter` when omitted.
   */
  adapter?: OhNetAdapter
}
