import type { OhNetAdapter } from "@/adapter/types"
import type { OhNetEventHandler, OhNetEventName } from "@/pipeline/types"
import type { OhNetContext } from "@/types"

/**
 * Internal registry of event handlers used by {@link OhNetBuilder.event}.
 *
 * @remarks
 * Not exported directly; reachable from outside only through
 * `builder.event` or `builder.on` / `builder.off`. Methods return new
 * instances rather than mutating the receiver, keeping builders immutable
 * under chained configuration.
 */
export class OhNetEventBuilder {
  #events: Map<OhNetEventName, OhNetEventHandler[]>

  constructor() {
    this.#events = new Map()
  }

  /**
   * Returns a shallow copy of this registry, preserving handler order.
   */
  fork(): OhNetEventBuilder {
    const child = new OhNetEventBuilder()
    for (const [event, list] of this.#events) {
      child.#events.set(event, [...list])
    }
    return child
  }

  /**
   * Returns the handlers registered for an event, or every registered handler
   * across all events when `event` is omitted.
   *
   * @remarks
   * The returned array is a fresh copy; mutating it does not affect the registry.
   */
  list(event?: OhNetEventName): readonly OhNetEventHandler[] {
    if (event === undefined) {
      const all: OhNetEventHandler[] = []
      for (const list of this.#events.values()) all.push(...list)
      return all
    }
    return [...(this.#events.get(event) ?? [])]
  }

  /**
   * Registers a handler for an event and returns a new registry with the
   * handler appended.
   *
   * @remarks
   * Duplicate registrations of the same callback are preserved and will fire
   * once per registration. `off` removes every registration that matches by
   * reference.
   */
  on(event: OhNetEventName, callback: OhNetEventHandler): OhNetEventBuilder {
    const child = this.fork()
    const list = [...(child.#events.get(event) ?? [])]
    list.push(callback)
    child.#events.set(event, list)
    return child
  }

  /**
   * Removes every registration matching the given callback reference and
   * returns a new registry.
   *
   * @remarks
   * No-op when the event has no registrations. The empty-event entry is
   * dropped to keep `list()` output free of zero-length arrays.
   */
  off(event: OhNetEventName, target: OhNetEventHandler): OhNetEventBuilder {
    const child = this.fork()
    const current = child.#events.get(event)
    if (!current)
      return child
    const next = current.filter(handler => handler !== target)
    if (next.length === 0)
      child.#events.delete(event)
    else child.#events.set(event, next)
    return child
  }

  /**
   * Invokes every handler registered for `event` in registration order.
   *
   * @remarks
   * Exceptions thrown by handlers are caught and discarded so a faulty
   * observer cannot break the pipeline. The pipeline never observes the
   * thrown error; surface critical failures through `context.error` instead.
   */
  emit(event: OhNetEventName, adapter: OhNetAdapter, context: OhNetContext): void {
    const list = this.#events.get(event)
    if (!list)
      return
    for (const handler of list) {
      try {
        handler(adapter, context)
      }
      catch {}
    }
  }
}
