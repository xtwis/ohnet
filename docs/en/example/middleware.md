---
title: Middleware Recipes
order: 2
---

# {{ $frontmatter.title }}

Middleware is where request policy lives: adding headers, short-circuiting, retrying, caching. This page is a catalogue of recipes you can lift into a client. Each one is self-contained; combine them with `.with(...)`.

Every hook receives the same `context`, plus a `controls` object:

| Hook    | Runs                         | Controls available           |
| ------- | ---------------------------- | ---------------------------- |
| `enter` | before the adapter, in order | `skip`, `terminate`, `retry` |
| `leave` | after the adapter, reversed  | `terminate`, `retry`         |

`context.meta` is a per-request bag reset on every `fork`. Values written by one middleware are visible to the next, which is how recipes below hand data to their own `leave`.

## Request Id

Stamp every request with a correlation id, and keep it in `meta` so logging middlewares can read it later.

```ts
import type { OhNetAdapter, OhNetContext } from "@xtwis/ohnet"
import { OhNetMiddleware } from "@xtwis/ohnet"

class RequestIdMiddleware extends OhNetMiddleware {
  readonly name = "request-id"

  readonly enter = async (_adapter: OhNetAdapter, context: OhNetContext): Promise<void> => {
    const id = context.request.headers.get("x-request-id") ?? crypto.randomUUID()
    context.request.headers.set("x-request-id", id)
    context.meta.requestId = id
  }
}
```

## Timing

Measure the adapter round trip. Recording the start in `enter` and the delta in `leave` excludes middleware work from the number, which is usually what you want.

```ts
class TimingMiddleware extends OhNetMiddleware {
  readonly name = "timing"

  constructor(private readonly onTiming: (url: string, ms: number) => void) {
    super()
  }

  readonly enter = async (_adapter: OhNetAdapter, context: OhNetContext): Promise<void> => {
    context.meta.startedAt = performance.now()
  }

  readonly leave = async (_adapter: OhNetAdapter, context: OhNetContext): Promise<void> => {
    const startedAt = context.meta.startedAt as number | undefined
    if (startedAt === undefined)
      return
    this.onTiming(context.request.url, performance.now() - startedAt)
  }
}
```

## Retry with Backoff

`controls.retry()` reruns the whole pipeline, capped at `middlewareRetries` (default `1`). `controls.retryCount` is `0` on the first attempt, so it doubles as the backoff exponent.

```ts
import type { OhNetMiddlewareLeaveControls } from "@xtwis/ohnet"

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

class BackoffRetryMiddleware extends OhNetMiddleware {
  readonly name = "backoff-retry"

  constructor(private readonly baseDelay = 300) {
    super()
  }

  readonly leave = async (
    _adapter: OhNetAdapter,
    context: OhNetContext,
    controls: OhNetMiddlewareLeaveControls,
  ): Promise<void> => {
    const code = (context.error as { code?: string } | null)?.code
    if (code !== "OHNET_NETWORK" && code !== "OHNET_TIMEOUT")
      return

    const attempt = controls.retryCount
    await sleep(this.baseDelay * 2 ** attempt)
    controls.retry()
  }
}

const client = new OhNetBuilder({
  url: "https://api.example.com",
  middlewareRetries: 3,
}).with(new BackoffRetryMiddleware())
```

Once the budget is spent, `controls.retry()` no longer helps and the request fails with `OHNET_RETRY_EXHAUSTED`.

## Response Cache

Serve repeat `GET`s from memory. `enter` can populate `context.response` and call `skip()`, which stops the adapter; when a response is already set, the pipeline reports `SUCCESS` rather than `SKIPPED`.

```ts
import type { OhNetMiddlewareEnterControls, OhNetResponse } from "@xtwis/ohnet"

interface CacheEntry {
  response: OhNetResponse
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

class CacheMiddleware extends OhNetMiddleware {
  readonly name = "cache"

  constructor(private readonly ttl: number) {
    super()
  }

  readonly enter = async (
    _adapter: OhNetAdapter,
    context: OhNetContext,
    controls: OhNetMiddlewareEnterControls,
  ): Promise<void> => {
    if (context.request.method !== "GET")
      return
    const entry = cache.get(context.request.url)
    if (!entry || entry.expiresAt <= Date.now())
      return
    context.response = entry.response
    controls.skip()
  }

  readonly leave = async (_adapter: OhNetAdapter, context: OhNetContext): Promise<void> => {
    if (context.request.method !== "GET" || context.error || !context.response)
      return
    const ok = context.response.status >= 200 && context.response.status < 300
    if (!ok)
      return
    cache.set(context.request.url, {
      response: context.response,
      expiresAt: Date.now() + this.ttl,
    })
  }
}
```

Register `unpack` **before** `cache` so the cached entry is still unwrapped on the way out: `cache.leave` runs first (reverse order) and stores the raw envelope, then `unpack.leave` unwraps it. The adapter runs only on a miss.

Note that the cached `OhNetResponse` is shared across requests. If a later middleware mutates it, clone it first with `createResponse` and a fresh `OhNetHeader`.

## In-flight Coalescing

Deduplicate identical requests that overlap in time: the first one runs, the rest wait for its result and skip the adapter.

```ts
const inflight = new Map<string, Promise<OhNetResponse | null>>()

interface DedupeEntry {
  key: string
  resolve: (value: OhNetResponse | null) => void
}

class DedupeMiddleware extends OhNetMiddleware {
  readonly name = "dedupe"

  readonly enter = async (
    _adapter: OhNetAdapter,
    context: OhNetContext,
    controls: OhNetMiddlewareEnterControls,
  ): Promise<void> => {
    const key = `${context.request.method} ${context.request.url}`
    const pending = inflight.get(key)
    if (pending) {
      const shared = await pending
      if (shared) {
        context.response = shared
        controls.skip()
        return
      }
    }

    const promise = new Promise<OhNetResponse | null>((resolve) => {
      context.meta.dedupe = { key, resolve } satisfies DedupeEntry
    })
    inflight.set(key, promise)
  }

  readonly leave = async (_adapter: OhNetAdapter, context: OhNetContext): Promise<void> => {
    const entry = context.meta.dedupe as DedupeEntry | undefined
    if (!entry)
      return
    entry.resolve(context.response)
    inflight.delete(entry.key)
  }
}
```

If the leader fails, it resolves the shared promise with `null`; followers see `null`, fall through, and issue their own request instead of inheriting the failure.

## Envelope Unpack

Flatten `{ code, data, message }` into just `data` on success, leaving failures for an error mapper downstream.

```ts
function isEnvelop(value: unknown): value is { code: number, data: unknown, message: string } {
  return typeof value === "object" && value !== null
    && "code" in value && "data" in value && "message" in value
}

class UnpackMiddleware extends OhNetMiddleware {
  readonly name = "unpack"

  readonly leave = async (_adapter: OhNetAdapter, context: OhNetContext): Promise<void> => {
    if (!context.response)
      return
    const body = context.response.data
    if (isEnvelop(body) && body.code === 0)
      context.response.data = body.data
  }
}
```

## Token Injection

Read a token from anywhere (memory, storage, a store) and attach it on the way in.

```ts
class TokenMiddleware extends OhNetMiddleware {
  readonly name = "token"

  constructor(private readonly getToken: () => string | undefined) {
    super()
  }

  readonly enter = async (_adapter: OhNetAdapter, context: OhNetContext): Promise<void> => {
    const token = this.getToken()
    if (token)
      context.request.headers.set("Authorization", `Bearer ${token}`)
  }
}
```

For refresh-on-401, pair this with a `leave` hook that calls `controls.retry()`. The full flow is in [Building a Business API Client](./business-client.md).

## Composing

Register in the order you want `enter` to run, then read `leave` backwards:

```ts
const client = new OhNetBuilder({ url: BASE })
  .with(new RequestIdMiddleware()) // enter 1st, leave last
  .with(new TokenMiddleware(getToken))
  .with(new BackoffRetryMiddleware())
  .on(OHNET_EVENT.ERROR, (_, ctx) => log(ctx.error))
```

A middleware that calls `terminate()` suppresses every remaining `enter` **and** `leave`; `skip()` only stops the `enter` chain, so `leave` still runs for what was already entered. See [Pipeline](../guide/pipeline.md) for the full control-flow rules.

## Next

- [Building a Business API Client](./business-client.md): these pieces assembled into an SDK.
- [Testing and Mock Adapters](./testing.md): prove each recipe without a network.
- [Pipeline](../guide/pipeline.md): control flow and lifecycle events.
