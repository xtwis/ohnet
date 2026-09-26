/**
 * Minimal abort interface that adapters and middleware can read from.
 *
 * @remarks
 * Designed to be duck-typed rather than pinned to the browser
 * `AbortSignal`. Three subscription shapes are accepted, all optional:
 * - W3C style (`addEventListener` / `removeEventListener`) - matches
 *   the native `AbortSignal`.
 * - Callback style (`onAbort` setter) - lightweight option for
 *   hand-rolled signals.
 * - Flag-only (`aborted` only) - read-once consumers that poll the flag
 *   without subscribing.
 *
 * `reason` carries the value passed to `abort()`, or `undefined` when
 * none was supplied.
 *
 * @example
 * ```ts
 * const controller = new AbortController()
 * const signal: OhNetSignal = controller.signal
 * if (!signal.aborted) {
 *   // safe to dispatch
 * }
 * ```
 */
export interface OhNetSignal {
  /** True once the signal has aborted. Always present. */
  readonly aborted: boolean
  /** Reason supplied to `abort()`, or `undefined` when none was given. */
  reason?: unknown
  /** W3C-style subscription; called once when the signal aborts. */
  addEventListener?: (type: "abort", listener: () => void) => void
  /** W3C-style unsubscription; removes a previously added `abort` listener. */
  removeEventListener?: (type: "abort", listener: () => void) => void
  /** Single-callback subscription; assigning replaces the prior listener. */
  onAbort?: () => void
}

/**
 * Lightweight `AbortSignal` implementation that does not depend on the
 * browser or Node global.
 *
 * @remarks
 * Implements {@link OhNetSignal} and accepts all three subscription
 * shapes the interface allows. Useful in environments without
 * `AbortController`, or when a request pipeline needs a self-contained
 * signal it controls.
 *
 * The internal listener set is cleared after `abort()` fires, so
 * listeners fire exactly once. Re-aborting is a no-op: the first
 * `abort()` call wins and subsequent calls do not change `reason` or
 * re-notify listeners.
 *
 * @example
 * ```ts
 * const controller = new OhNetController()
 * controller.signal.addEventListener("abort", () => {
 *   console.log(controller.signal.reason)
 * })
 * controller.abort("user cancelled")
 * ```
 */
export class OhNetController implements OhNetSignal {
  #aborted = false
  #reason: unknown
  #listeners = new Set<() => void>()
  #onAbort: (() => void) | undefined

  /**
   * Returns the controller itself as an `OhNetSignal` view. The
   * returned object is the same instance, so reads observe mutations
   * made through the controller.
   */
  get signal(): OhNetSignal {
    return this
  }

  /** True once `abort()` has been called. */
  get aborted(): boolean {
    return this.#aborted
  }

  /** Reason supplied to the most recent `abort()` call, or `undefined` if none. */
  get reason(): unknown {
    return this.#reason
  }

  /** Single-callback subscription; returns the currently registered listener, or `undefined`. */
  get onAbort(): (() => void) | undefined {
    return this.#onAbort
  }

  /** Replaces the current `onAbort` listener with `listener` (or clears it when `undefined`). */
  set onAbort(listener: (() => void) | undefined) {
    this.#onAbort = listener
  }

  /**
   * Registers a listener that fires once when the signal aborts.
   *
   * @remarks
   * Non-`"abort"` types are ignored. The listener runs at most once;
   * the internal listener set is cleared after `abort()` fires.
   *
   * @param type - Event name; only `"abort"` is honored.
   * @param listener - Callback to register.
   */
  addEventListener(type: "abort", listener: () => void): void {
    if (type !== "abort")
      return
    this.#listeners.add(listener)
  }

  /** Removes a previously registered `abort` listener. No-op when not registered. */
  removeEventListener(type: "abort", listener: () => void): void {
    if (type !== "abort")
      return
    this.#listeners.delete(listener)
  }

  /**
   * Marks the signal aborted and fires every registered listener plus
   * `onAbort`.
   *
   * @remarks
   * Subsequent calls are no-ops: the first `abort()` wins. Listeners
   * are cleared after firing, so they run at most once.
   *
   * @param reason - Optional reason stored on `this.reason`. Forwarded
   *   to listeners through the field, not as an argument.
   */
  abort(reason?: unknown): void {
    if (this.#aborted)
      return

    this.#aborted = true
    this.#reason = reason

    const listeners = [...this.#listeners]
    this.#listeners.clear()
    for (const listener of listeners)
      listener()

    const onAbort = this.#onAbort
    this.#onAbort = undefined
    onAbort?.()
  }
}

/**
 * Subscribes `listener` to `signal` and returns an unsubscribe handle.
 *
 * @remarks
 * Returns a no-op function when `signal` is `null` or `undefined`.
 * When `signal.aborted` is already `true`, `listener` runs synchronously
 * before the call returns and the unsubscribe handle is a no-op.
 * Otherwise the listener is attached via the highest-priority
 * subscription shape available:
 * - `addEventListener` when present (W3C style)
 * - `onAbort` setter otherwise (callback style)
 *
 * The returned function detaches the listener when the W3C shape was
 * used; for callback-style signals it restores the previously set
 * `onAbort` listener (preserving any wrapper installed by an earlier
 * subscriber).
 *
 * @param signal - Signal to subscribe to, or `null` / `undefined` to skip.
 * @param listener - Callback fired when the signal aborts.
 */
export function subscribeAbort(
  signal: OhNetSignal | null | undefined,
  listener: () => void,
): () => void {
  if (!signal)
    return () => {}

  if (signal.aborted) {
    listener()
    return () => {}
  }

  if (typeof signal.addEventListener === "function") {
    signal.addEventListener("abort", listener)
    return () => signal.removeEventListener?.("abort", listener)
  }

  const previous = signal.onAbort
  const wrapped = (): void => {
    previous?.()
    listener()
  }
  signal.onAbort = wrapped
  return () => {
    if (signal.onAbort === wrapped)
      signal.onAbort = previous
  }
}
