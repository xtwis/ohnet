---
title: HTTP Requests
order: 7
---

# {{ $frontmatter.title }}

This page covers the request surface: verbs, body decoding, query serialization, and per-request overrides. Everything below is a thin layer over the same underlying `request<T>(config)` entry point; understanding the entry point clarifies when each convenience matters.

## Verbs

Seven helpers (`get`, `post`, `put`, `delete`, `patch`, `head`, `options`) wrap `request<T>(config)` with a fixed `method` and a slightly trimmed signature:

```ts
// path, params, data are all optional
client.get<T>(path, params, data) // GET, params usually used here
client.post<T>(path, data) // POST, body via data
client.put<T>(path, data)
client.delete<T>(path, data)
client.patch<T>(path, data)
client.head<T>(path, data)
client.options<T>(path, data)
```

The first argument is always a **path fragment** concatenated onto the builder's URL (no separator is inserted: pass a leading `/` yourself). `data` is the request body, forwarded to the adapter verbatim.

Verb helpers exist for symmetry and readability. The actual power sits in `request<T>(config)`:

```ts
await client.request<MyResponse>({
  method: "POST",
  url: "/items",
  data: { foo: "bar" },
  responseType: "json",
})
```

Reach for `request()` when you need **per-request overrides** that don't fit the verb signature: a different `responseType`, a custom `signal`, a tighter `timeout`, or one-off `headers`. For everything else, the verb helpers are clearer.

## Body Decoding (`responseType`)

`responseType` decides what shape the adapter produces for `response.data`. The default is `"auto"`: pick `"json"` when `content-type: application/json`, otherwise `"text"`. This handles the 90% case (typed JSON APIs) without configuration.

Three overrides worth knowing:

- **`"json"`**: force `Response.json()` even when the server omits content-type.
- **`"stream"`**: return `response.body` as a `ReadableStream`. Required for large or unbounded payloads that don't fit in memory.
- **`"raw"`**: return the adapter's native transport object (e.g. the raw `Response`). Useful when a custom adapter exposes extra capabilities the framework doesn't model.

The full seven-way matrix (including `arraybuffer`, `blob`, and `text`) lives in [API Reference](../reference/api.md).

### Per-Request Override

`responseType` is per-request, so a streamed download can come from a client whose default is `auto`:

```ts
const stream = await client
  .append("/files/large")
  .request<ReadableStream>({ responseType: "stream" })
```

## Query Strings (`params`)

`params` is appended to the URL as a query string. Three shapes are accepted:

```ts
client.get("/search", "raw=1") // string
client.get("/search", { page: 2, tag: ["a", "b"] }) // Record
client.get("/search", new URLSearchParams([["q", "x"]])) // Iterable
```

### Picking a Shape

- **`Record`**: the default choice. Arrays expand into repeated keys (`?tag=a&tag=b`); `null` and `undefined` values are skipped. Handles ~90% of cases.
- **`string`**: when you have an **already-encoded** query string you want to pass verbatim (rare). Strip a leading `?` if present.
- **`URLSearchParams`**: when you need to **preserve insertion order** (e.g. a backend signature signs the query), or to control encoding edge cases the Record path doesn't cover.

```ts
// Record: null and undefined skip cleanly
client.get("/items", { page: 2, archived: undefined }) // produces: ?page=2

// URLSearchParams: when order matters
const qs = new URLSearchParams()
qs.append("z", "1")
qs.append("a", "2")
client.get("/items", qs) // produces: ?z=1&a=2
```

## Per-Request Overrides

Three fields matter most when overriding the builder defaults:

| Field               | Purpose                                                                   |
| ------------------- | ------------------------------------------------------------------------- |
| `timeout`           | Per-request deadline in ms; takes precedence over the builder's `timeout` |
| `signal`            | External `AbortSignal`; aborting before completion yields `OHNET_ABORT`   |
| `middlewareRetries` | Per-request retry cap; overrides the builder default                      |

```ts
const controller = new AbortController()

await client.get("/slow", undefined, undefined, {
  timeout: 5_000,
  signal: controller.signal,
  middlewareRetries: 3,
})
```

`signal` and `timeout` compose: a `signal` aborted before the timeout fires yields `OHNET_ABORT`; a timeout that elapses without an explicit abort yields `OHNET_TIMEOUT`. The two paths are distinguishable in catch sites (see [Error Handling](./errors.md)).

`middlewareRetries` only affects **middleware-driven** retries (`controls.retry()`). Adapter-level retries are governed by `autoRetries` separately and depend on the adapter implementation.

## Next

- [Building a Business API Client](../example/building-business-client.md): composing everything into a real SDK.
- [API Reference](../reference/api.md): full signatures and error codes.
