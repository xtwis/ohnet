/**
 * @description Minimal abort interface that adapters and middleware can read from. Designed to be duck-typed rather than pinned to the browser `AbortSignal`.
 * @see https://x.twis.uk/en/ohnet/reference/signal.html#ohnetsignal
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
 * @description Lightweight `AbortSignal` implementation that does not depend on the browser or Node global. Listeners fire exactly once after `abort()`.
 * @see https://x.twis.uk/en/ohnet/reference/signal.html#ohnetcontroller
 */
export class OhNetController implements OhNetSignal {
  #aborted = false
  #reason: unknown
  #listeners = new Set<() => void>()
  #onAbort: (() => void) | undefined

  /**
   * @description Returns the controller itself as an `OhNetSignal` view.
   * @see https://x.twis.uk/en/ohnet/reference/signal.html#ohnetcontroller
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

  /** Currently registered `onAbort` listener, or `undefined`. */
  get onAbort(): (() => void) | undefined {
    return this.#onAbort
  }

  /** Replaces the current `onAbort` listener with `listener` (or clears it when `undefined`). */
  set onAbort(listener: (() => void) | undefined) {
    this.#onAbort = listener
  }

  /**
   * @description Registers a listener that fires once when the signal aborts. Non-`"abort"` types are ignored.
   * @see https://x.twis.uk/en/ohnet/reference/signal.html#ohnetcontroller
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
   * @description Marks the signal aborted and fires every registered listener plus `onAbort`. Subsequent calls are no-ops.
   * @see https://x.twis.uk/en/ohnet/reference/signal.html#ohnetcontroller
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
 * @description Subscribes `listener` to `signal` and returns an unsubscribe handle. Returns a no-op when `signal` is `null` or `undefined`.
 * @see https://x.twis.uk/en/ohnet/reference/signal.html#subscribeabort
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
