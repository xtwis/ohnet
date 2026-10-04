import { OhNetError } from "@/model/error"

/**
 * @description `type` value assigned to every error produced by ohnet internals.
 * @see https://x.twis.uk/en/ohnet/reference/errors.html#ohneterror
 */
export const OHNET_ERROR_TYPE = "OHNET_INTERNAL"

/**
 * @description Canonical error codes for {@link OhNetInternalError}. Keys are stable; values land on `error.code`. Branch on `code`, not `message`.
 * @see https://x.twis.uk/en/ohnet/reference/errors.html#ohneterror
 */
export const OHNET_ERROR_CODE = {
  /** A middleware was registered with an empty or whitespace-only name. */
  MIDDLEWARE_NAME: "OHNET_MIDDLEWARE_NAME",
  /** The pipeline completed normally but neither the adapter nor any middleware populated `context.response`. */
  NO_RESPONSE: "OHNET_NO_RESPONSE",
  /** Middleware kept calling `controls.retry()` past `request.middlewareRetries`. */
  RETRY_EXHAUSTED: "OHNET_RETRY_EXHAUSTED",
  /** A middleware called `controls.skip()` (or `terminate()` in enter) and no other middleware wrote a response. */
  SKIPPED: "OHNET_SKIPPED",
} as const satisfies Record<string, string>

/**
 * @description Default human-readable messages for each {@link OHNET_ERROR_CODE}. Branch on `code`; messages are advisory and prefixed with `ohnet:`.
 * @see https://x.twis.uk/en/ohnet/reference/errors.html#ohneterror
 */
export const OHNET_ERROR_MESSAGE = {
  MIDDLEWARE_NAME: "ohnet: invalid middleware name",
  NO_RESPONSE: "ohnet: no response",
  RETRY_EXHAUSTED: "ohnet: middleware retry exhausted",
  SKIPPED: "ohnet: pipeline skipped",
} as const satisfies Record<string, string>

/**
 * @description `type` value assigned to every error produced by an adapter. Custom adapters should throw {@link OhNetAdapterError} with one of the {@link OHNET_ADAPTER_ERROR_CODE} codes.
 * @see https://x.twis.uk/en/ohnet/reference/errors.html#ohnetadaptererror
 */
export const OHNET_ADAPTER_ERROR_TYPE = "OHNET_ADAPTER"

/**
 * @description Canonical error codes for {@link OhNetAdapterError}. Keys are stable; values land on `error.code`. Branch on `code`, not `message`.
 * @see https://x.twis.uk/en/ohnet/reference/errors.html#ohnetadaptererror
 */
export const OHNET_ADAPTER_ERROR_CODE = {
  /** The user signal aborted the request before it completed. */
  ABORT: "OHNET_ABORT",
  /** The transport layer rejected the request for a reason other than timeout or abort. */
  NETWORK: "OHNET_NETWORK",
  /** The default `fetchAdapter` ran in an environment without `globalThis.fetch`. */
  NO_FETCH: "OHNET_NO_FETCH",
  /** The request exceeded `request.timeout` before completion. */
  TIMEOUT: "OHNET_TIMEOUT",
} as const satisfies Record<string, string>

/**
 * @description Default human-readable messages for each {@link OHNET_ADAPTER_ERROR_CODE}. Branch on `code`; messages are advisory and prefixed with `ohnet:`.
 * @see https://x.twis.uk/en/ohnet/reference/errors.html#ohnetadaptererror
 */
export const OHNET_ADAPTER_ERROR_MESSAGE = {
  ABORT: "adapter: aborted",
  NETWORK: "adapter: network error",
  NO_FETCH: "adapter: fetch is not available; pass an explicit adapter",
  TIMEOUT: "adapter: timeout",
} as const satisfies Record<string, string>

/**
 * @description `type` value for errors that did not originate in ohnet but were caught and re-wrapped by the dispatcher.
 * @see https://x.twis.uk/en/ohnet/reference/errors.html#ohneterror
 */
export const OHNET_UNKNOWN_ERROR_TYPE = "OHNET_UNKNOWN"

/**
 * @description `code` for unknown-origin errors. Always paired with {@link OHNET_UNKNOWN_ERROR_TYPE}.
 * @see https://x.twis.uk/en/ohnet/reference/errors.html#ohneterror
 */
export const OHNET_UNKNOWN_ERROR_CODE = "OHNET_UNKNOWN"

/**
 * @description Default message for unknown-origin errors. The original error lives on `error.error`.
 * @see https://x.twis.uk/en/ohnet/reference/errors.html#ohneterror
 */
export const OHNET_UNKNOWN_ERROR_MESSAGE = "ohnet: unknown error"

/**
 * @description Base class for errors produced by ohnet itself. `type` is fixed to {@link OHNET_ERROR_TYPE}; `code` carries the specific failure mode.
 * @see https://x.twis.uk/en/ohnet/reference/errors.html#ohneterror
 */
export class OhNetInternalError extends OhNetError {
  constructor(code: string, message: string, data?: unknown, error?: unknown) {
    super(OHNET_ERROR_TYPE, code, message, data, error)
  }
}

/**
 * @description Error produced by an adapter. `type` is fixed to {@link OHNET_ADAPTER_ERROR_TYPE}; `code` carries the specific failure mode.
 * @see https://x.twis.uk/en/ohnet/reference/errors.html#ohnetadaptererror
 */
export class OhNetAdapterError extends OhNetError {
  constructor(code: string, message: string, data?: unknown, error?: unknown) {
    super(OHNET_ADAPTER_ERROR_TYPE, code, message, data, error)
  }
}

/**
 * @description Error thrown when a non-`OhNetError` value bubbles up through the pipeline. The original value is preserved on `error.error`.
 * @see https://x.twis.uk/en/ohnet/reference/errors.html#ohneterror
 */
export class OhNetUnknownError extends OhNetError {
  constructor(error?: unknown) {
    super(OHNET_UNKNOWN_ERROR_TYPE, OHNET_UNKNOWN_ERROR_CODE, OHNET_UNKNOWN_ERROR_MESSAGE, undefined, error)
  }
}
