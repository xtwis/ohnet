---
title: Headers
order: 5
---

# {{ $frontmatter.title }}

`OhNetHeader` is a multi-value HTTP header collection with case-insensitive names and RFC 7230 validation. It behaves like the browser `Headers` class and additionally supports several input shapes.

## OhNetHeader

```ts
class OhNetHeader implements Iterable<[string, string]> {
  constructor(init?: OhNetHeaderLike | null)
  static from(init?: OhNetHeaderLike | null): OhNetHeader

  append(name: string, value: string): this
  set(name: string, value: string): this
  get(name: string): string | null
  has(name: string): boolean
  delete(name: string): boolean
  getSetCookie(): string[]

  forEach(callback: (value: string, key: string, parent: OhNetHeader) => void, thisArg?: unknown): void
  keys(): IterableIterator<string>
  values(): IterableIterator<string>
  entries(): IterableIterator<[string, string]>
  [Symbol.iterator](): IterableIterator<[string, string]>

  clone(): OhNetHeader
  concat(other: OhNetHeaderLike): OhNetHeader
  toRecord(): OhNetHeaderRecord
  toJSON(): OhNetHeaderRecord
}
```

Names are trimmed, lowercased, and validated against the RFC 7230 token grammar. Values reject NUL, CR, and LF, and are trimmed.

### constructor(init?)

Builds a collection from any [`OhNetHeaderLike`](#ohnetheaderlike). Omit `init` for an empty collection.

### OhNetHeader.from(init?)

Static alias of the constructor.

### append(name, value)

Adds `value` to the values stored under `name`. Existing values are kept. Throws `TypeError` on an invalid name or value. Returns `this`.

### set(name, value)

Replaces every value stored under `name` with `value`. Returns `this`.

### get(name)

Returns the values under `name` joined with `", "`, or `null` when absent.

### has(name)

Returns whether any value is stored under `name`.

### delete(name)

Removes every value under `name` and reports whether any were present.

### getSetCookie()

Returns the `set-cookie` values as an array. Set-cookie values must not be joined, so this mirrors `Headers.getSetCookie()` and returns a fresh copy.

### forEach(callback, thisArg?)

Invokes `callback` once per stored value. The callback receives `(value, name, parent)`. Multi-value headers yield once per value, not once per name.

### keys() / values() / entries()

Iterators aligned over values, so a header with two values yields its name twice from `keys()`. `[Symbol.iterator]` delegates to `entries()`, making the collection spreadable as `[...headers]`.

### clone()

Returns a deep copy that does not share storage with the receiver.

### concat(other)

Returns a new collection with `other` layered on top. Values in `other` replace values in the receiver for the same name; values unique to either side are preserved. The receiver is not mutated.

### toRecord()

Returns a plain object with values joined by `", "`. `toJSON` is the same, so `JSON.stringify(headers)` yields the object form.

## OhNetHeaderRecord

```ts
type OhNetHeaderRecord = Record<string, string>
```

Plain object form; each name maps to a single joined string.

## OhNetHeaderEntry

```ts
type OhNetHeaderEntry = readonly string[]
```

A single `[name, value]` pair.

## OhNetHeaderEntries

```ts
type OhNetHeaderEntries = Iterable<OhNetHeaderEntry>
```

An iterable of pairs, typically a `Map` or a generator.

## OhNetHeaderIterable

```ts
interface OhNetHeaderIterable {
  forEach: (callback: (value: string, key: string) => void, thisArg?: unknown) => void
}
```

Duck-typed surface compatible with the browser `Headers` class.

## OhNetHeaderLike

```ts
type OhNetHeaderLike
  = | OhNetHeader
    | OhNetHeaderRecord
    | OhNetHeaderEntries
    | OhNetHeaderIterable
```

Union of every input shape the constructor and `concat()` accept.

## Example

```ts
const headers = new OhNetHeader()
  .set("content-type", "application/json")
  .append("set-cookie", "a=1")
  .append("set-cookie", "b=2")

headers.get("content-type") // "application/json"
headers.getSetCookie() // ["a=1", "b=2"]
console.log([...headers]) // [["content-type", "application/json"], ["set-cookie", "a=1"], ["set-cookie", "b=2"]]
```

## Next

- [Adapter and Context](./transport.md): where `OhNetHeader` is used in requests and responses.
- [Signals](./signal.md): the other small value type.
- [Errors](./errors.md): classes thrown by header validation.
