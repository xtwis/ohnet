/** Plain object representation: each header name maps to a single joined string. */
export type OhNetHeaderRecord = Record<string, string>

/** A single `[name, value]` pair, normalized through `OhNetHeader`. */
export type OhNetHeaderEntry = readonly string[]

/** Iterable of `[name, value]` pairs, typically a `Map` or a generator. */
export type OhNetHeaderEntries = Iterable<OhNetHeaderEntry>

/**
 * Duck-typed surface compatible with the browser `Headers` class;
 * `OhNetHeader` reads values through it when no iterator is present.
 */
export interface OhNetHeaderIterable {
  forEach: (callback: (value: string, key: string) => void, thisArg?: unknown) => void
}

/** Union of every input shape the constructor and `concat()` accept. */
export type OhNetHeaderLike
  = | OhNetHeader
    | OhNetHeaderRecord
    | OhNetHeaderEntries
    | OhNetHeaderIterable

const INVALID_NAME = /[^!#$%&'*+\-.^\w`|~]/

function normalizeName(name: string): string {
  const normalized = String(name).trim().toLowerCase()
  if (!normalized || INVALID_NAME.test(normalized))
    throw new TypeError(`Invalid header name: ${name}`)
  return normalized
}

function normalizeValue(value: string): string {
  const raw = String(value)
  if (/[\0\r\n]/.test(raw))
    throw new TypeError(`Invalid header value: ${value}`)
  return raw.trim()
}

/**
 * Multi-value HTTP header collection with case-insensitive names and
 * RFC 7230 token validation.
 *
 * @remarks
 * Behaves like the browser `Headers` class but lives in the ohnet
 * namespace and supports a wider set of input shapes through the
 * constructor and `concat()`. Names are trimmed, normalized to
 * lowercase, and validated against the RFC 7230 token grammar;
 * values reject NUL, CR, and LF. Each name can hold multiple values
 * (`append` adds, `set` replaces), matching how servers and
 * intermediaries may emit them.
 *
 * Iteration surfaces every `(name, value)` pair - not one entry per
 * name - so consumers that need to handle duplicates (such as
 * `set-cookie`) can do so without manually splitting joined strings.
 * `getSetCookie()` exposes the `set-cookie` values as an array, the
 * same way `Headers.getSetCookie()` does.
 *
 * `clone()` and `concat()` produce new instances; the public
 * mutators (`append`, `set`, `delete`) return `this` for fluent use.
 *
 * @example
 * ```ts
 * const headers = new OhNetHeader()
 *   .set("content-type", "application/json")
 *   .append("set-cookie", "a=1")
 *   .append("set-cookie", "b=2")
 *
 * headers.get("content-type")          // "application/json"
 * headers.getSetCookie()               // ["a=1", "b=2"]
 * [...headers]                         // [["content-type", "application/json"], ["set-cookie", "a=1"], ["set-cookie", "b=2"]]
 * ```
 */
export class OhNetHeader implements Iterable<[string, string]> {
  readonly #store = new Map<string, string[]>()

  /**
   * Builds a new collection from `init`.
   *
   * @remarks
   * Accepts any {@link OhNetHeaderLike} shape:
   * - `undefined` / `null` - empty collection.
   * - `OhNetHeader` - deep copy of the source.
   * - `Iterable<[name, value]>` - `append` each pair.
   * - Duck-typed `forEach` (such as the browser `Headers`) -
   *   `forEach` with `(value, key)` argument order.
   * - `Record<string, string>` - one entry per property.
   *
   * @param init - Optional source to copy from. Defaults to empty.
   */
  constructor(init?: OhNetHeaderLike | null) {
    if (init === undefined || init === null)
      return

    if (init instanceof OhNetHeader) {
      for (const [key, values] of init.#store)
        this.#store.set(key, [...values])
      return
    }

    if (typeof (init as OhNetHeaderEntries)[Symbol.iterator] === "function") {
      for (const [key, value] of init as OhNetHeaderEntries)
        this.append(key, value)
      return
    }

    const iterable = init as OhNetHeaderIterable
    if (typeof iterable.forEach === "function") {
      iterable.forEach((value, key) => this.append(key, value))
      return
    }

    for (const [key, value] of Object.entries(init as OhNetHeaderRecord))
      this.append(key, value)
  }

  /**
   * Alias of the constructor for call sites that read more naturally
   * with a static factory.
   *
   * @param init - Optional source to copy from. Same shapes as the constructor.
   */
  static from(init?: OhNetHeaderLike | null): OhNetHeader {
    return new OhNetHeader(init)
  }

  /**
   * Adds `value` to the list of values stored under `name`.
   *
   * @remarks
   * Multi-value semantics: existing values are kept. Throws `TypeError`
   * when `name` is empty or fails RFC 7230 token validation, or when
   * `value` contains NUL, CR, or LF.
   *
   * @param name - Header name. Compared case-insensitively.
   * @param value - Header value. Trimmed of surrounding whitespace.
   */
  append(name: string, value: string): this {
    const key = normalizeName(name)
    const val = normalizeValue(value)
    const values = this.#store.get(key)
    if (values)
      values.push(val)
    else
      this.#store.set(key, [val])
    return this
  }

  /**
   * Replaces any existing values for `name` with a single-element
   * list containing `value`.
   *
   * @param name - Header name. Compared case-insensitively.
   * @param value - Header value. Trimmed of surrounding whitespace.
   */
  set(name: string, value: string): this {
    this.#store.set(normalizeName(name), [normalizeValue(value)])
    return this
  }

  /**
   * Returns the values stored under `name`, joined with `", "`, or
   * `null` when the name is absent.
   *
   * @remarks
   * Multi-value headers are joined into a single string. Use
   * {@link getSetCookie} for `set-cookie` values that must stay
   * separate.
   *
   * @param name - Header name. Compared case-insensitively.
   */
  get(name: string): string | null {
    const values = this.#store.get(normalizeName(name))
    return values ? values.join(", ") : null
  }

  /**
   * Returns whether any value is stored under `name`.
   *
   * @param name - Header name. Compared case-insensitively.
   */
  has(name: string): boolean {
    return this.#store.has(normalizeName(name))
  }

  /**
   * Removes every value stored under `name` and reports whether any
   * were present.
   *
   * @param name - Header name. Compared case-insensitively.
   */
  delete(name: string): boolean {
    return this.#store.delete(normalizeName(name))
  }

  /**
   * Returns the values stored under `set-cookie` as an array.
   *
   * @remarks
   * Set-cookie values must not be joined: `set-cookie: a=1, b=2` is
   * not equivalent to two separate cookies. This accessor mirrors
   * `Headers.getSetCookie()` and returns a fresh copy, so mutating
   * the result does not affect the collection.
   */
  getSetCookie(): string[] {
    return [...(this.#store.get("set-cookie") ?? [])]
  }

  /**
   * Invokes `callback` once per stored `(value, name)` pair.
   *
   * @remarks
   * Multi-value headers yield once per value, not once per name. The
   * callback receives `(value, name, parent)` in that order; the
   * `parent` argument exposes the receiver for chaining.
   *
   * @param callback - Function invoked for each value.
   * @param thisArg - Optional `this` binding for the callback.
   */
  forEach(callback: (value: string, key: string, parent: OhNetHeader) => void, thisArg?: unknown): void {
    for (const [key, values] of this.#store) {
      for (const value of values)
        callback.call(thisArg, value, key, this)
    }
  }

  /**
   * Yields each stored `name` once per value.
   *
   * @remarks
   * A header with two `set-cookie` values yields the name twice, so
   * `keys()` and `values()` stay aligned through iteration.
   */
  * keys(): IterableIterator<string> {
    for (const [key, values] of this.#store) {
      for (let i = 0; i < values.length; i++)
        yield key
    }
  }

  /** Yields each stored value once. */
  * values(): IterableIterator<string> {
    for (const values of this.#store.values()) {
      for (const value of values)
        yield value
    }
  }

  /**
   * Yields each `[name, value]` pair. Multi-value headers produce
   * one entry per value.
   */
  * entries(): IterableIterator<[string, string]> {
    for (const [key, values] of this.#store) {
      for (const value of values)
        yield [key, value]
    }
  }

  /**
   * Delegates to {@link entries}. Makes the collection spreadable as
   * `[...headers]`.
   */
  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries()
  }

  /**
   * Returns a deep copy of this collection. The result has the same
   * multi-value layout but does not share storage with the receiver.
   */
  clone(): OhNetHeader {
    return new OhNetHeader(this)
  }

  /**
   * Returns a new collection with `other` appended on top of this one.
   *
   * @remarks
   * Values in `other` replace values in the receiver for the same
   * name; values unique to either side are preserved. The receiver
   * is not mutated.
   *
   * @param other - Source to layer on top of the receiver.
   */
  concat(other: OhNetHeaderLike): OhNetHeader {
    const source = OhNetHeader.from(other)
    const result = this.clone()
    for (const [key, values] of source.#store)
      result.#store.set(key, [...values])
    return result
  }

  /**
   * Returns a plain object view with values joined by `", "`.
   *
   * @remarks
   * Multi-value headers collapse into a single string. Use
   * {@link entries} when multi-value fidelity matters.
   */
  toRecord(): OhNetHeaderRecord {
    const record: OhNetHeaderRecord = {}
    for (const [key, values] of this.#store)
      record[key] = values.join(", ")
    return record
  }

  /**
   * Same as {@link toRecord}. Used by `JSON.stringify` so the
   * collection serializes to a plain object.
   */
  toJSON(): OhNetHeaderRecord {
    return this.toRecord()
  }
}
