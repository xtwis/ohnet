import type { OhNetError } from "@/model/error"
import type { OhNetHeader } from "@/model/header"
import type { OhNetSignal } from "@/model/signal"

/**
 * HTTP request methods supported by ohnet.
 *
 * @remarks
 * The set matches the methods a typical fetch-based client can issue. Custom
 * methods are not allowed; adapters that need verbs outside this list should
 * encode them in the path or fall back to a low-level adapter.
 */
export type OhNetMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS"

/**
 * Strategy the adapter uses to deserialize the response body.
 *
 * @remarks
 * - `"auto"` - pick `"json"` when `content-type` is `application/json`, otherwise `"text"`.
 * - `"json"` - `Response.json()`. Returns `null` on parse failure instead of throwing.
 * - `"text"` - `Response.text()`.
 * - `"arraybuffer"` - `Response.arrayBuffer()`.
 * - `"blob"` - `Response.blob()`.
 * - `"stream"` - `Response.body` (a `ReadableStream`).
 * - `"raw"` - the underlying `Response` object itself.
 */
export type OhNetResponseType = "auto" | "json" | "text" | "arraybuffer" | "blob" | "stream" | "raw"

/**
 * Classification of a response, mirroring the Fetch specification's `Response.type`.
 *
 * @remarks
 * Most adapters always produce `"default"` (same-origin) or `"cors"` (cross-origin
 * with CORS headers). Values such as `"opaque"` and `"opaqueredirect"` only appear
 * for no-cors requests whose response body is intentionally unreadable; ohnet
 * surfaces them verbatim but cannot inspect the body in those cases.
 *
 * @see https://fetch.spec.whatwg.org/#responses
 */
export type OhNetResponseKind = "basic" | "cors" | "default" | "error" | "opaque" | "opaqueredirect"

/**
 * Query string source for a request.
 *
 * @remarks
 * Three forms are accepted:
 * - `string` - used verbatim, with a leading `?` stripped if present.
 * - `Record<string, unknown>` - entries are URL-encoded; arrays expand into
 *   repeated keys (`?tag=a&tag=b`); `null` and `undefined` values are skipped.
 * - `Iterable<[name, value]>` - raw pair iteration for callers that need to
 *   preserve order or emit duplicate keys without going through an object.
 *
 * @example
 * ```ts
 * const a: OhNetParams = "raw=1"
 * const b: OhNetParams = { page: 2, tag: ["a", "b"] }
 * const c: OhNetParams = new URLSearchParams([["q", "x"]])
 * ```
 */
export type OhNetParams
  = | string
    | Record<string, unknown>
    | Iterable<readonly [string, string]>

/**
 * A fully-resolved request handed to an adapter.
 *
 * @remarks
 * Produced by the builder after merging the constructor config, any subsequent
 * `.fork()` / `.with()` overrides, and HTTP verb helpers. Adapters receive this
 * struct as `context.request` and must not mutate it.
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
  /** Request body. Adapters decide how to serialize it (e.g. JSON for plain objects). */
  data?: unknown
  /** External abort signal. The adapter wires this through to its own transport. */
  signal?: OhNetSignal
  /** Timeout in milliseconds. Adapters may abort the request when it elapses. */
  timeout?: number
  /** Maximum middleware-driven retries per request. Defaults to `1`. */
  middlewareRetries?: number
  /** Adapter-level auto-retry signal; passed to the adapter verbatim, semantics adapter-defined. */
  autoRetries?: boolean | number
  /** Body decoding strategy. See {@link OhNetResponseType}. */
  responseType: OhNetResponseType
}

/**
 * A response produced by an adapter, normalized to ohnet's shape.
 *
 * @typeParam T - Type of the decoded `data` payload. Defaults to `unknown`.
 *
 * @remarks
 * `data` carries the decoded body when `responseType` is one of the decoding
 * variants. `body` is reserved for transports that want to expose the raw
 * underlying object (e.g. the native `Response` when `responseType: "raw"`);
 * most adapters leave it `undefined`.
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
 * Mutable context shared across the middleware pipeline for a single request.
 *
 * @remarks
 * Middlewares can mutate `request` before the adapter runs (e.g. attach auth
 * headers) and observe `response` / `error` after. `meta` is an open bag for
 * middleware-to-middleware communication; values written in an earlier
 * middleware are visible to later ones.
 *
 * The builder treats `response` and `error` as mutually exclusive terminators:
 * after the pipeline finishes, at most one of them is non-null. A populated
 * `response` short-circuits to a success event; a populated `error` short-circuits
 * to the error event. When neither is set, the builder throws
 * `OHNET_NO_RESPONSE` or `OHNET_SKIPPED` based on whether a middleware skipped.
 */
export interface OhNetContext {
  /** The request being executed. Safe to mutate until the adapter runs. */
  request: OhNetRequest
  /** Adapter result. Null before the adapter runs and after a skip/error path. */
  response: OhNetResponse | null
  /** Adapter or middleware error. Checked before `response` to determine outcome. */
  error: OhNetError | null
  /** Open metadata bag. Symbol keys are allowed; useful for non-colliding middleware state. */
  meta: Record<string | symbol, unknown>
}
