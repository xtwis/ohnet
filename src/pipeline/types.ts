import type { OhNetAdapter } from "@/adapter/types"
import type { OhNetContext } from "@/types"

/**
 * @description Canonical lifecycle event names emitted by the request pipeline. Use these constants rather than typing literals.
 * @see https://x.twis.uk/en/ohnet/reference/middleware.html#ohnetevent
 */
export const OHNET_EVENT = {
  /** Pipeline begins. Fires before any middleware runs. */
  START: "on_start",
  /** Fires at the top of a retry attempt (any attempt after the first). */
  RETRY: "on_retry",
  /** All middleware `enter` hooks have run and the adapter is about to be called. */
  REQUEST: "on_request",
  /** The adapter (or a middleware) has produced a `context.response`. */
  RESPONSE: "on_response",
  /** Terminal event when the request succeeded: `context.response` is set and `context.error` is `null`. */
  SUCCESS: "on_success",
  /** Terminal event when the pipeline was short-circuited by `controls.skip()` or `terminate()`. */
  SKIP: "on_skip",
  /** Terminal event when `context.error` is non-null. */
  ERROR: "on_error",
  /** Always the last event of the pipeline, fired after the terminal event. */
  FINISH: "on_finish",
} as const satisfies Record<string, string>

/**
 * @description Union of valid event names accepted by {@link OhNetBuilder.on}.
 * @see https://x.twis.uk/en/ohnet/reference/middleware.html#ohneteventname
 */
export type OhNetEventName = (typeof OHNET_EVENT)[keyof typeof OHNET_EVENT]

/**
 * @description Signature of an event handler registered via {@link OhNetBuilder.on}.
 * @see https://x.twis.uk/en/ohnet/reference/middleware.html#ohneteventhandler
 */
export type OhNetEventHandler = (adapter: OhNetAdapter, context: OhNetContext) => void

/**
 * @description Controls available to a middleware `enter` hook. All three methods only set a flag on the dispatcher.
 * @see https://x.twis.uk/en/ohnet/reference/middleware.html#ohnetmiddlewareentercontrols
 */
export interface OhNetMiddlewareEnterControls {
  /**
   * Marks the request as skipped: later `enter` hooks do not run, the adapter is not called, and the pipeline ends with `OHNET_SKIPPED` unless `context.response` is populated.
   */
  skip: () => void
  /**
   * Marks the request as terminated: later `enter` hooks do not run and the `leave` chain is suppressed entirely.
   */
  terminate: () => void
  /**
   * Marks the request for retry: the dispatcher re-runs the entire pipeline, capped at `request.middlewareRetries`.
   */
  retry: () => void
  /** Retries before this hook runs; `0` on the initial attempt. */
  readonly retryCount: number
}

/**
 * @description Controls available to a middleware `leave` hook. Only `terminate` and `retry` are exposed.
 * @see https://x.twis.uk/en/ohnet/reference/middleware.html#ohnetmiddlewarleavecontrols
 */
export interface OhNetMiddlewareLeaveControls {
  /**
   * Aborts the rest of the leave chain.
   */
  terminate: () => void
  /**
   * Marks the request for retry. Same semantics as `OhNetMiddlewareEnterControls.retry`.
   */
  retry: () => void
  /** Retries before this hook runs; `0` on the initial attempt. */
  readonly retryCount: number
}

/**
 * @description Abstract base class for middlewares. Subclass and implement `name` plus whichever of `enter` / `leave` apply.
 * @see https://x.twis.uk/en/ohnet/reference/middleware.html#ohnetmiddleware
 */
export abstract class OhNetMiddleware {
  /** Stable identifier used by {@link OhNetBuilder.clean} and by replacement semantics in {@link OhNetBuilder.with}. Must be a non-whitespace string. */
  abstract readonly name: string
  /** Pre-adapter hook. Runs in registration order before any subsequent middleware's `enter` and before the adapter call. Optional. */
  enter?(adapter: OhNetAdapter, context: OhNetContext, controls: OhNetMiddlewareEnterControls): Promise<void>
  /** Post-adapter hook. Runs in reverse registration order after the adapter returns. Optional. */
  leave?(adapter: OhNetAdapter, context: OhNetContext, controls: OhNetMiddlewareLeaveControls): Promise<void>
}
