---
title: Builder
---

# {{ $frontmatter.title }}

`OhNetBuilder` is the single entry point of ohnet. Every configuration method is fluent and immutable: each call returns a new instance instead of mutating the receiver. That makes builders safe to share, derive, and reuse across requests.

## Creating a Builder

```ts
import { OhNetBuilder } from "@xtwis/ohnet"

const client = new OhNetBuilder({
  url: "https://api.example.com",
  // optional:
  // adapter: myAdapter,             // default: built-in fetch adapter
  // headers: { "x-app": "demo" },   // seed headers
  // timeout: 10_000,                // per-request default
  // middlewareRetries: 1,           // retry cap
})
```

The only required field is `url`. Pass `adapter` to swap the transport; see [Adapter](./adapter.md).

## Configuration Methods

Every method returns a new `OhNetBuilder`:

| Method                | Returns        | Purpose                                    |
| --------------------- | -------------- | ------------------------------------------ |
| `fork(config?)`       | `OhNetBuilder` | Derive a child with optional overrides     |
| `add(config)`         | `OhNetBuilder` | Alias of `fork` requiring a config         |
| `with(middleware)`    | `OhNetBuilder` | Register or replace a middleware by `name` |
| `clean(name)`         | `OhNetBuilder` | Remove a middleware by `name`              |
| `on(event, handler)`  | `OhNetBuilder` | Register an event handler                  |
| `off(event, handler)` | `OhNetBuilder` | Remove an event handler (by reference)     |
| `append(path)`        | `OhNetBuilder` | Concatenate `path` onto the current URL    |

### Deriving Children

`fork()` and `add()` produce a child builder that shares the parent's middlewares, events, and adapter, then applies the overrides you pass. Crucially, the child's `meta` map is reset to `{}`, so middleware-to-middleware state never leaks between requests:

```ts
const v1 = client.fork({ headers: { "x-version": "1" } })
const v2 = client.fork({ headers: { "x-version": "2" } })

await v1.get("/items") // x-version: 1
await v2.get("/items") // x-version: 2
await client.get("/items") // no x-version
```

Use this pattern to spin up per-request variants (auth scopes, language, feature flags) from a shared base.

### URL Composition

`append(path)` concatenates `path` onto the current URL. **No separator is inserted**: pass a leading `/` yourself:

```ts
const api = new OhNetBuilder({ url: "https://api.example.com" })
const v1 = api.append("/v1")
const items = v1.append("/items") // produces: https://api.example.com/v1/items
```

`append` does not strip existing query strings. If you need a fresh query, fork with a new `url` instead.

### Middleware Registry

`with()` registers by `name`; registering two middlewares with the same name swaps the implementation in the same slot. `clean(name)` removes every middleware with that name:

```ts
const a = client.with(new TimingMiddleware())
const b = a.with(new OtherTimingMiddleware("timing")) // replaces "timing"
const c = b.clean("timing") // back to no timing
```

Introspect the registry with `builder.middleware.list()`.

## HTTP Verbs

Seven convenience methods, all returning `Promise<T>` where `T` is the expected shape of `response.data`:

```ts
// path, params, data are all optional
client.get<T>(path, params, data)
client.post<T>(path, data)
client.put<T>(path, data)
client.delete<T>(path, data)
client.patch<T>(path, data)
client.head<T>(path, data)
client.options<T>(path, data)
```

For full control, use `request<T>(config)`:

```ts
await client.request<MyResponse>({
  url: "/items",
  method: "POST",
  headers: { "content-type": "application/json" },
  data: { foo: "bar" },
  params: { trace: 1 },
  signal: controller.signal,
  timeout: 5_000,
  middlewareRetries: 2,
  autoRetries: 3,
  responseType: "json",
})
```

See [HTTP Requests](./http.md) for details on `params`, `responseType`, and per-request overrides.

## Putting It Together

A typical chain reads top-to-bottom: base URL, then middlewares, then events, then verb:

```ts
import { OHNET_EVENT, OhNetBuilder } from "@xtwis/ohnet"

const client = new OhNetBuilder({ url: BASE })
  .with(new AuthMiddleware(/* getToken, refresh, onToken */))
  .with(new UnpackMiddleware())
  .with(new TimingMiddleware())
  .on(OHNET_EVENT.ERROR, (_, ctx) => log(ctx.error))

await client.post("/login", { user, pass })
```

Because every method returns a new builder, you can keep the original around for reuse, and `fork` it any time you need a one-off variant.

## Next

- [Pipeline](./pipeline.md): middleware enter/leave hooks and lifecycle events.
- [Adapter](./adapter.md): when and how to write a custom adapter.
