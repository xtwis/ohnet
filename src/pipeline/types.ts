import type { OhNetAdapter } from "@/adapter/types"
import type { OhNetContext } from "@/types"

/**
 * Canonical event names emitted by the request pipeline.
 *
 * @remarks
 * Use these constants with {@link OhNetBuilder.on} rather than typing the
 * literal directly. The values mirror an `on_<event>` naming so event names
 * read naturally at handler sites (`OHNET_EVENT.START === "on_start"`).
 *
 * Each event fires at a fixed point in the pipeline with a known `context`
 * shape - see the per-event remarks below. Handlers run in registration
 * order; exceptions are swallowed by the emitter and do not affect the
 * pipeline outcome.
 *
 * `START` fires once at the top of the call.
 *
 * Each attempt fires `REQUEST` -> adapter -> `RESPONSE` -> leave
 * middlewares -> `SUCCESS` / `ERROR` / `SKIP` -> `FINISH`.
 *
 * When a middleware calls `controls.retry()` and the dispatcher
 * decides to run another attempt, `RETRY` fires at the top of that
 * retry attempt. The cycle repeats until the request resolves or
 * `OHNET_RETRY_EXHAUSTED` is thrown.
 *
 * @example
 * ```ts
 * builder
 *   .on(OHNET_EVENT.START, () => trace.begin())
 *   .on(OHNET_EVENT.SUCCESS, (_, ctx) => trace.end(ctx.response))
 *   .on(OHNET_EVENT.ERROR, (_, ctx) => trace.fail(ctx.error))
 * ```
 */
export const OHNET_EVENT = {
  /**
   * Pipeline begins. Fires before any middleware runs.
   * `context.response` and `context.error` are both `null`.
   */
  START: "on_start",
  /**
   * Fires at the top of a retry attempt (any attempt after the first).
   * Not fired on the first attempt; observers can read
   * `controls.retryCount` to know which retry number this is.
   */
  RETRY: "on_retry",
  /**
   * All middleware `enter` hooks have run and the adapter is about to be
   * called. `context.request` reflects every middleware mutation so far.
   */
  REQUEST: "on_request",
  /**
   * The adapter (or a middleware) has produced a `context.response`.
   * Fires regardless of `response.status` - successful and HTTP-error
   * responses both pass through here.
   */
  RESPONSE: "on_response",
  /**
   * Terminal event when the request succeeded: `context.response` is set
   * and `context.error` is `null`. Mutually exclusive with `ERROR` and
   * `SKIP` for any given request.
   */
  SUCCESS: "on_success",
  /**
   * Terminal event when the pipeline was short-circuited: a middleware
   * called `controls.skip()` (or `terminate()` in enter) and no
   * `context.response` was provided. `context.error` is `null`.
   */
  SKIP: "on_skip",
  /**
   * Terminal event when `context.error` is non-null. Fires after
   * `RESPONSE` if a response was also produced, since `error` is checked
   * first when resolving the request outcome.
   */
  ERROR: "on_error",
  /**
   * Always the last event of the pipeline, fired after the terminal
   * event (`SUCCESS` / `SKIP` / `ERROR`). Use it for cleanup that must
   * run on every code path.
   */
  FINISH: "on_finish",
} as const satisfies Record<string, string>

/**
 * Union of valid event names accepted by {@link OhNetBuilder.on}.
 */
export type OhNetEventName = (typeof OHNET_EVENT)[keyof typeof OHNET_EVENT]

/**
 * Signature of an event handler registered via {@link OhNetBuilder.on}.
 *
 * @param adapter - The adapter that handled the request, or `null` when the
 *   pipeline was short-circuited before the adapter ran.
 * @param context - The mutable request context. Inspect `response` / `error`
 *   to branch on outcome; treat as read-only.
 */
export type OhNetEventHandler = (adapter: OhNetAdapter, context: OhNetContext) => void

/**
 * Controls available to a middleware `enter` hook.
 *
 * @remarks
 * Both methods only set a flag on the dispatcher; the flag is consulted
 * after the hook returns. Calling either method is idempotent within a
 * single request - the first call wins.
 */
export interface OhNetMiddlewareEnterControls {
  /**
   * Marks the request as skipped: later middleware `enter` hooks do not
   * run, the adapter is not called, and the pipeline ends with
   * `OHNET_SKIPPED` unless `context.response` was also populated (in
   * which case `OHNET_SUCCESS` wins).
   */
  skip: () => void
  /**
   * Marks the request as terminated: later middleware `enter` hooks do
   * not run and the middleware `leave` chain is suppressed entirely.
   * Behaves like `skip` for the success/error outcome, but additionally
   * prevents any cleanup in middlewares that were entered.
   */
  terminate: () => void
  /**
   * Marks the request for retry: the dispatcher re-runs the entire
   * pipeline (enter hooks, adapter, leave hooks). Capped at
   * `request.middlewareRetries`; once exceeded the request fails with
   * `OHNET_RETRY_EXHAUSTED`. The previous attempt's `response` stays
   * on `context.response` until the next adapter call.
   */
  retry: () => void
  /** Retries before this hook runs; `0` on the initial attempt. */
  readonly retryCount: number
}

/**
 * Controls available to a middleware `leave` hook.
 *
 * @remarks
 * Only `terminate` and `retry` are exposed here; there is no `skip`
 * because there is no work to skip on the way out - leave hooks fire
 * in reverse registration order, and skipping one would just mean
 * the rest of the chain runs against a partially torn-down context.
 * `retry` re-runs the pipeline from the top, same as on enter.
 */
export interface OhNetMiddlewareLeaveControls {
  /**
   * Aborts the rest of the leave chain. Subsequent middleware `leave`
   * hooks do not run, and the request resolves normally if a response
   * was already produced.
   */
  terminate: () => void
  /**
   * Marks the request for retry. Same semantics as
   * {@link OhNetMiddlewareEnterControls.retry}: the dispatcher re-runs
   * the pipeline from the top, capped at `request.middlewareRetries`.
   * The previous attempt's response stays on `context.response` until
   * the next adapter call.
   */
  retry: () => void
  /** Retries before this hook runs; `0` on the initial attempt. */
  readonly retryCount: number
}

/**
 * Abstract base class for middlewares.
 *
 * @remarks
 * Subclass and implement `name` plus whichever of `enter` / `leave` apply.
 * Both hooks run as part of the request pipeline:
 *
 * - `enter` runs in registration order, before the adapter is called.
 *   Use it to mutate `context.request`, attach metadata via
 *   `context.meta`, or short-circuit with the controls.
 * - `leave` runs in reverse registration order, after the adapter has
 *   returned. Use it for cleanup, response transformation, or logging.
 *
 * Exceptions thrown inside `enter` or `leave` are caught by the
 * dispatcher and assigned to `context.error`, which then surfaces as an
 * `OHNET_NETWORK` error after the leave chain finishes. Throw
 * `OhNetError` directly to preserve the original code.
 *
 * @example
 * ```ts
 * class AuthMiddleware extends OhNetMiddleware {
 *   readonly name = "auth"
 *   async enter(_adapter, context, controls) {
 *     if (!context.request.headers.has("authorization")) {
 *       controls.terminate()
 *       context.error = new OhNetError("AUTH", "OHNET_AUTH", "missing token")
 *     }
 *   }
 * }
 * ```
 */
export abstract class OhNetMiddleware {
  /**
   * Stable identifier used by {@link OhNetBuilder.clean} and by replacement
   * semantics in {@link OhNetBuilder.with}. Must be a non-whitespace string.
   */
  abstract readonly name: string
  /**
   * Pre-adapter hook. Runs in registration order before any subsequent
   * middleware's `enter` and before the adapter call. Optional.
   */
  enter?(adapter: OhNetAdapter, context: OhNetContext, controls: OhNetMiddlewareEnterControls): Promise<void>
  /**
   * Post-adapter hook. Runs in reverse registration order after the adapter
   * returns. Optional.
   */
  leave?(adapter: OhNetAdapter, context: OhNetContext, controls: OhNetMiddlewareLeaveControls): Promise<void>
}
