import type { OhNetAdapter } from "@/adapter/types"
import type { OhNetEventHandler, OhNetEventName } from "@/pipeline/types"
import type { OhNetContext } from "@/types"

/**
 * @internal
 * @description Internal registry of event handlers used by {@link OhNetBuilder.event}. Reachable from outside only through `builder.event` or `builder.on` / `builder.off`. Methods return new instances.
 */
export class OhNetEventBuilder {
  #events: Map<OhNetEventName, OhNetEventHandler[]>

  constructor() {
    this.#events = new Map()
  }

  /**
   * @description Returns a shallow copy of this registry, preserving handler order.
   */
  fork(): OhNetEventBuilder {
    const child = new OhNetEventBuilder()
    for (const [event, list] of this.#events) {
      child.#events.set(event, [...list])
    }
    return child
  }

  /**
   * @description Returns the handlers registered for an event, or every registered handler across all events when `event` is omitted. The returned array is a fresh copy.
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
   * @description Registers a handler for an event and returns a new registry with the handler appended. Duplicate registrations are preserved.
   */
  on(event: OhNetEventName, callback: OhNetEventHandler): OhNetEventBuilder {
    const child = this.fork()
    const list = [...(child.#events.get(event) ?? [])]
    list.push(callback)
    child.#events.set(event, list)
    return child
  }

  /**
   * @description Removes every registration matching the given callback reference and returns a new registry. The empty-event entry is dropped when no callbacks are left.
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
   * @description Invokes every handler registered for `event` in registration order. Exceptions thrown by handlers are caught and discarded.
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
