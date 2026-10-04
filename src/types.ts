import type { OhNetError } from "@/model/error"
import type { OhNetHeader } from "@/model/header"
import type { OhNetSignal } from "@/model/signal"

/**
 * @description HTTP request methods supported by ohnet. Matches the verbs a typical fetch-based client can issue.
 * @see https://x.twis.uk/en/ohnet/reference/transport.html#ohnetmethod
 */
export type OhNetMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS"

/**
 * @description Strategy the adapter uses to deserialize the response body.
 * @see https://x.twis.uk/en/ohnet/reference/transport.html#ohnetresponsetype
 */
export type OhNetResponseType = "auto" | "json" | "text" | "arraybuffer" | "blob" | "stream" | "raw"

/**
 * @description Classification of a response, mirroring the Fetch specification's `Response.type`.
 * @see https://x.twis.uk/en/ohnet/reference/transport.html#ohnetresponsekind
 */
export type OhNetResponseKind = "basic" | "cors" | "default" | "error" | "opaque" | "opaqueredirect"

/**
 * @description Query string source for a request. Accepts a `string`, a `Record<string, unknown>`, or an `Iterable<[name, value]>`.
 * @see https://x.twis.uk/en/ohnet/reference/transport.html#ohnetparams
 */
export type OhNetParams
  = | string
    | Record<string, unknown>
    | Iterable<readonly [string, string]>

/**
 * @description A fully-resolved request handed to an adapter. Adapters receive this as `context.request` and must not mutate it.
 * @see https://x.twis.uk/en/ohnet/reference/transport.html#ohnetrequest
 */
export interface OhNetRequest {
  /** Target URL. May include an existing query string; the builder does not strip it. */
  url: string
  /** HTTP method. */
  method: OhNetMethod
  /** Outgoing headers. Always an `OhNetHeader` instance, never `null`. */
  headers: OhNetHeader
  /** Query string source. `undefined` means "do not append a query string". */
  params?: OhNetParams
  /** Request body. Adapters decide how to serialize it. */
  data?: unknown
  /** External abort signal. The adapter wires this through to its own transport. */
  signal?: OhNetSignal
  /** Timeout in milliseconds. Adapters may abort the request when it elapses. */
  timeout?: number
  /** Maximum middleware-driven retries per request. Defaults to `1`. */
  middlewareRetries?: number
  /** Adapter-level auto-retry signal; passed to the adapter verbatim. */
  autoRetries?: boolean | number
  /** Body decoding strategy. See {@link OhNetResponseType}. */
  responseType: OhNetResponseType
}

/**
 * @description A response produced by an adapter, normalized to ohnet's shape.
 * @see https://x.twis.uk/en/ohnet/reference/transport.html#ohnetresponse
 */
export interface OhNetResponse<T = unknown> {
  /** HTTP status code. */
  status: number
  /** HTTP status text. Empty string when the transport did not provide one. */
  statusText: string
  /** True when `status` is in the 200-299 range, unless the adapter overrides it. */
  ok: boolean
  /** Response headers as an `OhNetHeader`. */
  headers: OhNetHeader
  /** Final URL after redirects. May differ from the request URL. */
  url: string
  /** True if the response came from at least one redirect. */
  redirected: boolean
  /** Response classification, mirroring the Fetch specification. */
  type: OhNetResponseKind
  /** Decoded body. Type is determined by `T` and `responseType`. */
  data: T
  /** Raw transport object when the adapter wants to expose it (e.g. `"raw"` mode). */
  body?: unknown
}

/**
 * @description Mutable context shared across the middleware pipeline for a single request. The builder treats `response` and `error` as mutually exclusive terminators.
 * @see https://x.twis.uk/en/ohnet/reference/transport.html#ohnetcontext
 */
export interface OhNetContext {
  /** The request being executed. Safe to mutate until the adapter runs. */
  request: OhNetRequest
  /** Adapter result. Null before the adapter runs and after a skip/error path. */
  response: OhNetResponse | null
  /** Adapter or middleware error. Checked before `response` to determine outcome. */
  error: OhNetError | null
  /** Open metadata bag. Symbol keys are allowed. */
  meta: Record<string | symbol, unknown>
}
