/** Plain object representation: each header name maps to a single joined string. */
export type OhNetHeaderRecord = Record<string, string>

/** A single `[name, value]` pair, normalized through `OhNetHeader`. */
export type OhNetHeaderEntry = readonly string[]

/** Iterable of `[name, value]` pairs, typically a `Map` or a generator. */
export type OhNetHeaderEntries = Iterable<OhNetHeaderEntry>

/**
 * @description Duck-typed surface compatible with the browser `Headers` class.
 * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
 */
export interface OhNetHeaderIterable {
  forEach: (callback: (value: string, key: string) => void, thisArg?: unknown) => void
}

/**
 * @description Union of every input shape the constructor and `concat()` accept.
 * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
 */
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
 * @description Multi-value HTTP header collection with case-insensitive names and RFC 7230 token validation. Behaves like the browser `Headers` class.
 * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
 */
export class OhNetHeader implements Iterable<[string, string]> {
  readonly #store = new Map<string, string[]>()

  /**
   * @description Builds a new collection from `init`. Accepts `undefined`, `OhNetHeader`, an `Iterable<[name, value]>`, a duck-typed `forEach`, or a `Record<string, string>`.
   * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
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
   * @description Alias of the constructor for call sites that read more naturally with a static factory.
   * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
   */
  static from(init?: OhNetHeaderLike | null): OhNetHeader {
    return new OhNetHeader(init)
  }

  /**
   * @description Adds `value` to the list of values stored under `name`. Throws `TypeError` on invalid names/values.
   * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
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
   * @description Replaces any existing values for `name` with a single-element list containing `value`.
   * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
   */
  set(name: string, value: string): this {
    this.#store.set(normalizeName(name), [normalizeValue(value)])
    return this
  }

  /**
   * @description Returns the values stored under `name`, joined with `", "`, or `null` when the name is absent.
   * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
   */
  get(name: string): string | null {
    const values = this.#store.get(normalizeName(name))
    return values ? values.join(", ") : null
  }

  /**
   * @description Returns whether any value is stored under `name`.
   * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
   */
  has(name: string): boolean {
    return this.#store.has(normalizeName(name))
  }

  /**
   * @description Removes every value stored under `name` and reports whether any were present.
   * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
   */
  delete(name: string): boolean {
    return this.#store.delete(normalizeName(name))
  }

  /**
   * @description Returns the values stored under `set-cookie` as an array. Mirrors `Headers.getSetCookie()`.
   * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
   */
  getSetCookie(): string[] {
    return [...(this.#store.get("set-cookie") ?? [])]
  }

  /**
   * @description Invokes `callback` once per stored `(value, name)` pair. Multi-value headers yield once per value.
   * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
   */
  forEach(callback: (value: string, key: string, parent: OhNetHeader) => void, thisArg?: unknown): void {
    for (const [key, values] of this.#store) {
      for (const value of values)
        callback.call(thisArg, value, key, this)
    }
  }

  /**
   * @description Yields each stored `name` once per value so `keys()` and `values()` stay aligned through iteration.
   * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
   */
  * keys(): IterableIterator<string> {
    for (const [key, values] of this.#store) {
      for (let i = 0; i < values.length; i++)
        yield key
    }
  }

  /**
   * @description Yields each stored value once.
   * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
   */
  * values(): IterableIterator<string> {
    for (const values of this.#store.values()) {
      for (const value of values)
        yield value
    }
  }

  /**
   * @description Yields each `[name, value]` pair. Multi-value headers produce one entry per value.
   * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
   */
  * entries(): IterableIterator<[string, string]> {
    for (const [key, values] of this.#store) {
      for (const value of values)
        yield [key, value]
    }
  }

  /**
   * @description Delegates to {@link entries}. Makes the collection spreadable as `[...headers]`.
   * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
   */
  [Symbol.iterator](): IterableIterator<[string, string]> {
    return this.entries()
  }

  /**
   * @description Returns a deep copy of this collection.
   * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
   */
  clone(): OhNetHeader {
    return new OhNetHeader(this)
  }

  /**
   * @description Returns a new collection with `other` layered on top of this one. Values in `other` replace values in the receiver for the same name; the receiver is not mutated.
   * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
   */
  concat(other: OhNetHeaderLike): OhNetHeader {
    const source = OhNetHeader.from(other)
    const result = this.clone()
    for (const [key, values] of source.#store)
      result.#store.set(key, [...values])
    return result
  }

  /**
   * @description Returns a plain object view with values joined by `", "`. Multi-value headers collapse into a single string.
   * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
   */
  toRecord(): OhNetHeaderRecord {
    const record: OhNetHeaderRecord = {}
    for (const [key, values] of this.#store)
      record[key] = values.join(", ")
    return record
  }

  /**
   * @description Same as {@link toRecord}. Used by `JSON.stringify`.
   * @see https://x.twis.uk/en/ohnet/reference/header.html#ohnetheader
   */
  toJSON(): OhNetHeaderRecord {
    return this.toRecord()
  }
}
