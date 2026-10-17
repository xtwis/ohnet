import type { OhNetEventHandler, OhNetEventName } from "@/pipeline/types"

/**
 * @description Read-only query over a client's event registry. Returned by {@link OhNetClient.events} for introspection. Each call returns a fresh snapshot of the client's current state; mutations on the query are not propagated back to the client.
 * @see https://x.twis.uk/en/ohnet/reference/client.html#event-query
 */
export class OhNetEventQuery {
  readonly #events: ReadonlyMap<OhNetEventName, readonly OhNetEventHandler[]>

  constructor(events: ReadonlyMap<OhNetEventName, readonly OhNetEventHandler[]>) {
    this.#events = events
  }

  /**
   * @description Returns the handlers registered for an event, or `undefined` when none is registered. The returned array is a fresh copy.
   */
  get(event: OhNetEventName): readonly OhNetEventHandler[] | undefined {
    const list = this.#events.get(event)
    return list === undefined ? undefined : [...list]
  }

  /**
   * @description Returns whether an event has any handler registered.
   */
  has(event: OhNetEventName): boolean {
    return this.#events.has(event)
  }

  /**
   * @description Returns the handlers registered for an event, or every registered handler across all events when `event` is omitted. The returned array is a fresh copy.
   */
  list(event?: OhNetEventName): readonly OhNetEventHandler[] {
    if (event === undefined) {
      const all: OhNetEventHandler[] = []
      for (const list of this.#events.values())
        all.push(...list)
      return all
    }
    return [...(this.#events.get(event) ?? [])]
  }
}
