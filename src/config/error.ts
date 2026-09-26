import { OhNetError } from "@/model/error"

/**
 * `type` value assigned to every error produced by ohnet internals.
 *
 * @remarks
 * Distinct from {@link OHNET_UNKNOWN_ERROR_TYPE}. Errors thrown directly by
 * middleware keep the type the middleware chose (typically the same value).
 */
export const OHNET_ERROR_TYPE = "OHNET_INTERNAL"

/**
 * Canonical error codes for {@link OhNetInternalError}.
 *
 * @remarks
 * Keys are stable identifiers; values are the string literal that ends up
 * on `error.code`. Catch sites should branch on `code`, not on `message`,
 * because messages are subject to change.
 *
 * @example
 * ```ts
 * try {
 *   await client.get("/users")
 * }
 * catch (error) {
 *   if (error instanceof OhNetError && error.code === OHNET_ERROR_CODE.SKIPPED) {
 *     // the pipeline was skipped before the adapter ran
 *   }
 * }
 * ```
 */
export const OHNET_ERROR_CODE = {
  /**
   * A middleware was registered with an empty or whitespace-only name.
   * `with()` rejects the registration before it can affect the pipeline.
   */
  MIDDLEWARE_NAME: "OHNET_MIDDLEWARE_NAME",
  /**
   * The pipeline completed normally (no skip, no terminate, no error) but
   * neither the adapter nor any middleware populated `context.response`.
   */
  NO_RESPONSE: "OHNET_NO_RESPONSE",
  /**
   * Middleware kept calling `controls.retry()` past
   * `request.middlewareRetries`. The previous attempt's
   * response is left on `context.response`.
   */
  RETRY_EXHAUSTED: "OHNET_RETRY_EXHAUSTED",
  /**
   * A middleware called `controls.skip()` (or `terminate()` in enter) and
   * no other middleware wrote a response. The adapter did not run.
   */
  SKIPPED: "OHNET_SKIPPED",
} as const satisfies Record<string, string>

/**
 * Default human-readable messages for each {@link OHNET_ERROR_CODE}.
 *
 * @remarks
 * Messages are advisory; downstream code should branch on `code`. They are
 * prefixed with `ohnet:` so log lines and error dumps are easy to grep.
 */
export const OHNET_ERROR_MESSAGE = {
  MIDDLEWARE_NAME: "ohnet: invalid middleware name",
  NO_RESPONSE: "ohnet: no response",
  RETRY_EXHAUSTED: "ohnet: middleware retry exhausted",
  SKIPPED: "ohnet: pipeline skipped",
} as const satisfies Record<string, string>

/**
 * `type` value assigned to every error produced by an adapter.
 *
 * @remarks
 * Distinct from {@link OHNET_ERROR_TYPE} (framework internals) and
 * {@link OHNET_UNKNOWN_ERROR_TYPE} (errors caught from outside othnet).
 * Custom adapters should throw {@link OhNetAdapterError} with one of the
 * {@link OHNET_ADAPTER_ERROR_CODE} codes so the failure mode is machine-readable.
 */
export const OHNET_ADAPTER_ERROR_TYPE = "OHNET_ADAPTER"

/**
 * Canonical error codes for {@link OhNetAdapterError}.
 *
 * @remarks
 * Keys are stable identifiers; values are the string literal that ends up
 * on `error.code`. Catch sites should branch on `code`, not on `message`,
 * because messages are subject to change.
 *
 * @example
 * ```ts
 * try {
 *   await client.get("/users")
 * }
 * catch (error) {
 *   if (error instanceof OhNetError && error.code === OHNET_ADAPTER_ERROR_CODE.NETWORK) {
 *     // transport rejected the request; consider a retry
 *   }
 * }
 * ```
 */
export const OHNET_ADAPTER_ERROR_CODE = {
  /**
   * The user signal aborted the request before it completed.
   * `error.data` carries the abort reason when one was supplied.
   */
  ABORT: "OHNET_ABORT",
  /**
   * The transport layer rejected the request for a reason other than
   * timeout or abort (DNS failure, connection reset, TLS error, etc.).
   */
  NETWORK: "OHNET_NETWORK",
  /**
   * The default `fetchAdapter` ran in an environment where
   * `globalThis.fetch` is not a function. Pass an explicit adapter or run
   * in an environment with fetch support.
   */
  NO_FETCH: "OHNET_NO_FETCH",
  /**
   * The request exceeded `request.timeout` before completion.
   * `error.error` carries the underlying `AbortError` from the transport.
   */
  TIMEOUT: "OHNET_TIMEOUT",
} as const satisfies Record<string, string>

/**
 * Default human-readable messages for each {@link OHNET_ADAPTER_ERROR_CODE}.
 *
 * @remarks
 * Messages are advisory; downstream code should branch on `code`. They are
 * prefixed with `ohnet:` so log lines and error dumps are easy to grep.
 */
export const OHNET_ADAPTER_ERROR_MESSAGE = {
  ABORT: "adapter: aborted",
  NETWORK: "adapter: network error",
  NO_FETCH: "adapter: fetch is not available; pass an explicit adapter",
  TIMEOUT: "adapter: timeout",
} as const satisfies Record<string, string>

/**
 * `type` value for errors that did not originate in ohnet but were caught
 * and re-wrapped by the dispatcher.
 *
 * @see {@link OhNetUnknownError}
 */
export const OHNET_UNKNOWN_ERROR_TYPE = "OHNET_UNKNOWN"

/**
 * `code` for unknown-origin errors. Always paired with
 * {@link OHNET_UNKNOWN_ERROR_TYPE} on an {@link OhNetUnknownError}.
 */
export const OHNET_UNKNOWN_ERROR_CODE = "OHNET_UNKNOWN"

/**
 * Default message for unknown-origin errors. The original error is preserved
 * on `error.error` for debugging.
 */
export const OHNET_UNKNOWN_ERROR_MESSAGE = "ohnet: unknown error"

/**
 * Base class for errors produced by ohnet itself.
 *
 * @remarks
 * `type` is fixed to {@link OHNET_ERROR_TYPE}; the specific failure mode is
 * conveyed by `code`, which should be one of {@link OHNET_ERROR_CODE}.
 * Use {@link OhNetUnknownError} for non-ohnet failures the dispatcher caught.
 */
export class OhNetInternalError extends OhNetError {
  /**
   * @param code - One of {@link OHNET_ERROR_CODE} values.
   * @param message - Human-readable description; usually the matching entry
   *   from {@link OHNET_ERROR_MESSAGE}.
   * @param data - Optional structured payload attached to the error.
   * @param error - Optional underlying cause preserved on `error.error`.
   */
  constructor(code: string, message: string, data?: unknown, error?: unknown) {
    super(OHNET_ERROR_TYPE, code, message, data, error)
  }
}

/**
 * Error produced by an adapter.
 *
 * @remarks
 * `type` is fixed to {@link OHNET_ADAPTER_ERROR_TYPE}; the specific
 * failure mode is conveyed by `code`, which should be one of
 * {@link OHNET_ADAPTER_ERROR_CODE}. The built-in `fetchAdapter` throws
 * these on transport-level failures; custom adapters should do the same
 * so callers can distinguish adapter errors from framework errors
 * ({@link OhNetInternalError}) via `instanceof`.
 *
 * @example
 * ```ts
 * try {
 *   await client.get("/items")
 * }
 * catch (error) {
 *   if (error instanceof OhNetAdapterError) {
 *     console.error("adapter failure:", error.code, error.error)
 *   }
 * }
 * ```
 */
export class OhNetAdapterError extends OhNetError {
  /**
   * @param code - One of {@link OHNET_ADAPTER_ERROR_CODE} values.
   * @param message - Human-readable description; usually the matching entry
   *   from {@link OHNET_ADAPTER_ERROR_MESSAGE}.
   * @param data - Optional structured payload attached to the error.
   * @param error - Optional underlying cause preserved on `error.error`.
   */
  constructor(code: string, message: string, data?: unknown, error?: unknown) {
    super(OHNET_ADAPTER_ERROR_TYPE, code, message, data, error)
  }
}

/**
 * Error thrown when a non-`OhNetError` value bubbles up through the pipeline.
 *
 * @remarks
 * The original value is preserved on `error.error` so it can still be
 * inspected, logged, or pattern-matched downstream. `type` is fixed to
 * {@link OHNET_UNKNOWN_ERROR_TYPE} and `code` to
 * {@link OHNET_UNKNOWN_ERROR_CODE}; branching on these distinguishes
 * "this came from outside ohnet" from any {@link OhNetInternalError}.
 *
 * @example
 * ```ts
 * try {
 *   await client.get("/items")
 * }
 * catch (error) {
 *   if (error instanceof OhNetUnknownError) {
 *     console.error("unexpected:", error.error)
 *   }
 * }
 * ```
 */
export class OhNetUnknownError extends OhNetError {
  /**
   * @param error - The original value that triggered the wrap. Omit when the
   *   failure had no underlying cause (e.g. a synchronous throw with `undefined`).
   */
  constructor(error?: unknown) {
    super(OHNET_UNKNOWN_ERROR_TYPE, OHNET_UNKNOWN_ERROR_CODE, OHNET_UNKNOWN_ERROR_MESSAGE, undefined, error)
  }
}
