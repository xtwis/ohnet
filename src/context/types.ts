import type { OhNetAdapter } from "@/adapter/types"
import type { OhNetHeaderLike } from "@/model/header"
import type { OhNetSignal } from "@/model/signal"
import type { OhNetMethod, OhNetParams, OhNetResponseKind, OhNetResponseType } from "@/types"

/**
 * @description Partial request configuration used to override a builder's current state. Every field is optional.
 * @see https://x.twis.uk/en/ohnet/reference/builder.html#ohnetrequestconfig
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
  /** Adapter-level auto-retry signal; passed to the adapter verbatim. */
  autoRetries?: boolean | number
  /** Body decoding strategy for the adapter. */
  responseType?: OhNetResponseType
}

/**
 * @description Loose response shape produced by adapters and consumed by {@link createResponse}. Lets adapters skip first wrapping them in {@link OhNetResponse}.
 * @see https://x.twis.uk/en/ohnet/reference/transport.html#ohnetresponselike
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
 * @description Top-level configuration passed to `new OhNetBuilder(config)`. When `adapter` is omitted, the built-in `fetchAdapter` is used.
 * @see https://x.twis.uk/en/ohnet/reference/builder.html#ohnetconfig
 */
export interface OhNetConfig extends OhNetRequestConfig {
  /** Transport implementation. Stored on the builder and invoked once per request. Defaults to the built-in `fetchAdapter`. */
  adapter?: OhNetAdapter
}
