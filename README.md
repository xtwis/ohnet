<div align="center">

# @xtwis/ohnet

Fluent, immutable HTTP client with middleware pipeline for building business-oriented request frameworks.

[![npm version](https://img.shields.io/npm/v/@xtwis/ohnet)](https://www.npmjs.com/package/@xtwis/ohnet)
[![CI](https://img.shields.io/github/actions/workflow/status/xtwis/ohnet/ci.yml?branch=main)](https://github.com/xtwis/ohnet/actions)
[![License](https://img.shields.io/npm/l/@xtwis/ohnet)](./LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@xtwis/ohnet)](https://bundlephobia.com/package/@xtwis/ohnet)

</div>

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [Builder](#builder)
  - [Middleware](#middleware)
  - [Adapter](#adapter)
  - [Events](#events)
- [HTTP Requests](#http-requests)
  - [Response decoding](#response-decoding)
  - [Query strings](#query-strings)
- [Error Handling](#error-handling)
- [Building a Business API Client](#building-a-business-api-client)
- [Examples](#examples)
- [API Reference](#api-reference)
  - [Classes](#classes)
  - [Types](#types)
  - [Constants](#constants)
  - [Utilities](#utilities)
- [License](#license)

## Features

- **Zero runtime dependencies**: bring your own adapter or use the included default
- **Fluent immutable builder**: safe to derive child clients without mutating shared state
- **Middleware pipeline**: declarative hooks with control flow for each phase
- **Lifecycle event hooks** for tracing, logging, and metrics
- **Pluggable transport layer**: swap the adapter to support custom protocols, custom transports, or run on any platform
- **Unified error system** with categorized failure modes for reliable catch-site branching
- **TypeScript-first** with full type inference

## Installation

```bash
pnpm add @xtwis/ohnet
# or
npm install @xtwis/ohnet
# or
yarn add @xtwis/ohnet
```

## Quick Start

```ts
import { OhNetBuilder } from "@xtwis/ohnet"

const client = new OhNetBuilder({ url: "https://api.example.com" })

const user = await client.get<{ id: string, name: string }>("/users/1")
console.log(user.id, user.name)
```

The builder is fluent and immutable. Every configuration call returns a new instance, safe to share and derive.

## Core Concepts

### Builder

`OhNetBuilder` is the single entry point. Every configuration method returns a new builder:

| Method                                               | Returns        | Purpose                                    |
| ---------------------------------------------------- | -------------- | ------------------------------------------ |
| `fork(config?)`                                      | `OhNetBuilder` | Derive a child with optional overrides     |
| `add(config)`                                        | `OhNetBuilder` | Alias of `fork` requiring a config         |
| `with(middleware)`                                   | `OhNetBuilder` | Register or replace a middleware by `name` |
| `clean(name)`                                        | `OhNetBuilder` | Remove a middleware by `name`              |
| `on(event, handler)`                                 | `OhNetBuilder` | Register an event handler                  |
| `off(event, handler)`                                | `OhNetBuilder` | Remove an event handler (by reference)     |
| `append(path)`                                       | `OhNetBuilder` | Concatenate `path` onto the current URL    |
| `get / post / put / delete / patch / head / options` | `Promise<T>`   | Issue a request                            |
| `request<T>(config)`                                 | `Promise<T>`   | Generic entry with full config             |

The child's `meta` map is reset on every `fork`, so middleware-to-middleware state does not leak between requests.

### Middleware

Subclass `OhNetMiddleware` to plug into the request pipeline. A middleware has a stable `name`, an optional `enter` hook, and an optional `leave` hook:

```ts
import type { OhNetContext } from "@xtwis/ohnet"
import { OhNetMiddleware } from "@xtwis/ohnet"

class TimingMiddleware extends OhNetMiddleware {
  readonly name = "timing"

  enter(_adapter, context) {
    context.meta.startedAt = Date.now()
  }

  leave(_adapter, context) {
    const started = context.meta.startedAt as number
    console.log(`elapsed: ${Date.now() - started}ms`)
  }
}
```

`enter` hooks fire in registration order, before the adapter. `leave` hooks fire in reverse registration order, after the adapter returns.

Each hook receives a `controls` object with three methods:

| Method                 | Effect                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `controls.skip()`      | Adapter does not run; pipeline ends with `OHNET_SKIPPED` unless `context.response` is populated |
| `controls.terminate()` | Subsequent `enter` (or `leave`) hooks do not run                                                |
| `controls.retry()`     | Re-runs the entire pipeline from the top; capped at `request.middlewareRetries`                 |

When `retry()` exceeds `middlewareRetries`, the request fails with `OHNET_RETRY_EXHAUSTED`.

### Adapter

The adapter is the transport boundary: the single point where ohnet hands control to a concrete HTTP implementation. Everything else (builder, middleware, events) is transport-agnostic and works against any function matching this signature:

```ts
type OhNetAdapter = (context: OhNetContext) => Promise<OhNetResponse>
```

A minimal `fetch`-based adapter ships with the library and is used when no `adapter` is supplied to the constructor. It bridges the user `signal`, enforces `request.timeout`, JSON-encodes plain object bodies, and honors `request.autoRetries`. It is a sensible default for any runtime with a standard `fetch` global: modern browsers, Node 18+, Deno, Bun, Cloudflare Workers, Vercel Edge, and similar. If your platform provides `fetch`, you do not need to do anything.

Replace the default by passing an `adapter` to the constructor. Implementations only need to honor the `OhNetAdapter` signature: middleware, events, retry semantics, and error mapping stay unchanged when you swap the transport:

```ts
const client = new OhNetBuilder({
  url: "https://api.example.com",
  adapter: myAdapter,
})
```

Typical reasons to write a custom adapter include reaching runtimes without `fetch` (older Node, embedded JS engines), using a non-HTTP transport (gRPC, WebSocket, in-memory mocks), wrapping a legacy SDK or platform-specific client (axios, XMLHttpRequest), or injecting deterministic failures and latency for tests. Errors thrown by the adapter flow through the framework's error system unchanged. Throw `OhNetAdapterError` (or let any other error bubble) so catch sites can branch on `OHNET_ADAPTER_ERROR_CODE`.

To make this concrete, here is a complete `XMLHttpRequest`-based adapter. It is intentionally small (around 30 lines) and covers the four responsibilities every adapter must own: **issuing the request**, **resolving with the response**, **honoring cancellation**, and **surfacing failures**. Use it as a template when writing your own:

```ts
import type { OhNetAdapter } from "@xtwis/ohnet"
import {
  OHNET_ADAPTER_ERROR_CODE,
  OHNET_ADAPTER_ERROR_MESSAGE,
  OhNetAdapterError,
  OhNetBuilder,
  OhNetHeader,
} from "@xtwis/ohnet"

const xhrAdapter: OhNetAdapter = (context) => {
  return new Promise((resolve, reject) => {
    const { url, method, headers, data, signal, timeout } = context.request
    const xhr = new XMLHttpRequest()
    xhr.open(method, url)

    if (timeout !== undefined)
      xhr.timeout = timeout
    headers.forEach((value, name) => xhr.setRequestHeader(name, value))

    const onAbort = (): void => {
      xhr.abort()
      reject(new OhNetAdapterError(
        OHNET_ADAPTER_ERROR_CODE.ABORT,
        OHNET_ADAPTER_ERROR_MESSAGE.ABORT,
      ))
    }
    signal?.addEventListener?.("abort", onAbort)

    xhr.onload = () => {
      signal?.removeEventListener?.("abort", onAbort)
      resolve({
        status: xhr.status,
        statusText: xhr.statusText,
        ok: xhr.status >= 200 && xhr.status < 300,
        headers: new OhNetHeader(xhr.getAllResponseHeaders()),
        url,
        redirected: false,
        type: "default",
        data: xhr.responseText,
        body: xhr,
      })
    }

    xhr.onerror = () => {
      signal?.removeEventListener?.("abort", onAbort)
      reject(new OhNetAdapterError(
        OHNET_ADAPTER_ERROR_CODE.NETWORK,
        OHNET_ADAPTER_ERROR_MESSAGE.NETWORK,
      ))
    }

    xhr.ontimeout = () => {
      signal?.removeEventListener?.("abort", onAbort)
      reject(new OhNetAdapterError(
        OHNET_ADAPTER_ERROR_CODE.TIMEOUT,
        OHNET_ADAPTER_ERROR_MESSAGE.TIMEOUT,
      ))
    }

    xhr.send(data as XMLHttpRequestBodyInit | null)
  })
}

const client = new OhNetBuilder({
  url: "https://api.example.com",
  adapter: xhrAdapter,
})
```

The same shape applies to any transport or runtime: gRPC, WebSocket, an in-memory mock, an axios wrapper, a legacy SDK. Implement the four responsibilities, throw `OhNetAdapterError` with the appropriate code, and the rest of the framework (middleware, events, retries) keeps working unchanged.

### Events

Register handlers against any of the 8 lifecycle events:

```ts
import { OHNET_EVENT } from "@xtwis/ohnet"

const client = new OhNetBuilder({ url: "https://api.example.com" })
  .on(OHNET_EVENT.START, (_, ctx) => trace.begin(ctx.request.url))
  .on(OHNET_EVENT.SUCCESS, (_, ctx) => trace.end(ctx.response?.status))
  .on(OHNET_EVENT.ERROR, (_, ctx) => trace.fail(ctx.error))
  .on(OHNET_EVENT.FINISH, () => trace.flush())
```

Per-request order: a `START` event fires at the top, then `REQUEST` before the adapter runs, `RESPONSE` after the adapter returns, then one of `SUCCESS`, `SKIP`, or `ERROR`, and finally `FINISH`. Retries emit `RETRY` between attempts. Handler exceptions are caught and discarded. They do not affect the pipeline.

## HTTP Requests

```ts
// All 7 verbs (every verb accepts an optional path string)
client.get<T>(path, params, data)
client.post<T>(path, data)
client.put<T>(path, data)
client.delete<T>(path, data)
client.patch<T>(path, data)
client.head<T>(path, data)
client.options<T>(path, data)

// Generic entry: full config
client.request<T>({
  url,
  method,
  headers,
  params,
  data,
  signal,
  timeout,
  middlewareRetries,
  autoRetries,
  responseType,
})
```

### Response decoding

Set `responseType` on the request to control how the body is decoded:

| Value              | Decoded as                                                     |
| ------------------ | -------------------------------------------------------------- |
| `"auto"` (default) | JSON when `content-type` is `application/json`, otherwise text |
| `"json"`           | `Response.json()`, returns `null` on parse failure             |
| `"text"`           | `Response.text()`                                              |
| `"arraybuffer"`    | `Response.arrayBuffer()`                                       |
| `"blob"`           | `Response.blob()`                                              |
| `"stream"`         | `Response.body` (`ReadableStream`)                             |
| `"raw"`            | The native `Response` object itself                            |

### Query strings

`params` accepts three shapes:

```ts
client.get("/search", "raw=1")
client.get("/search", { page: 2, tag: ["a", "b"] })
client.get("/search", new URLSearchParams([["q", "x"]]))
```

Arrays expand into repeated keys (`?tag=a&tag=b`); `null` and `undefined` values are skipped.

## Error Handling

Every error thrown by ohnet is an `OhNetError` with five fields:

```ts
class OhNetError extends Error {
  type: string // coarse classification
  code: string // specific failure mode
  message: string // human-readable
  data?: unknown // optional structured payload
  error?: unknown // optional underlying cause
}
```

Three top-level types are produced by the library:

| `type`           | Class                | When                                                                                        |
| ---------------- | -------------------- | ------------------------------------------------------------------------------------------- |
| `OHNET_INTERNAL` | `OhNetInternalError` | Framework-level outcome (`SKIPPED` / `NO_RESPONSE` / `RETRY_EXHAUSTED` / `MIDDLEWARE_NAME`) |
| `OHNET_ADAPTER`  | `OhNetAdapterError`  | Transport-level failure (`NETWORK` / `TIMEOUT` / `ABORT` / `NO_FETCH`)                      |
| `OHNET_UNKNOWN`  | `OhNetUnknownError`  | Non-`OhNetError` value caught from a middleware                                             |

Branch on `code`, not `message`:

```ts
import {
  OHNET_ADAPTER_ERROR_CODE,
  OHNET_ERROR_CODE,
  OhNetError,
} from "@xtwis/ohnet"

try {
  await client.get("/items")
}
catch (error) {
  if (error instanceof OhNetError) {
    if (error.code === OHNET_ADAPTER_ERROR_CODE.TIMEOUT) {
      // retry, fall back, show "slow network"
    }
    else if (error.code === OHNET_ERROR_CODE.SKIPPED) {
      // pipeline was short-circuited
    }
  }
}
```

Custom adapters should throw `OhNetAdapterError` with one of the `OHNET_ADAPTER_ERROR_CODE` values so callers can distinguish adapter errors from framework errors via `instanceof`.

## Building a Business API Client

The real value of ohnet is using it to build a domain-specific request framework. Here is a minimal "auth + envelope unpacking + unified business errors" stack that you can extend:

```ts
import type { OhNetContext, OhNetMiddlewareLeaveControls } from "@xtwis/ohnet"
import { OhNetBuilder, OhNetMiddleware } from "@xtwis/ohnet"

// A response envelope is { code, data, message }
function isEnvelop(value: unknown): value is { code: number, data: unknown, message: string } {
  return typeof value === "object" && value !== null
    && "code" in value && "data" in value && "message" in value
}

// 1. Unpack { code, data, message } -> return data on success
class UnpackMiddleware extends OhNetMiddleware {
  readonly name = "unpack"
  readonly leave = async (_a, ctx: OhNetContext): Promise<void> => {
    const body = ctx.response?.data
    if (ctx.response && isEnvelop(body) && body.code === 0)
      ctx.response.data = body.data
  }
}

// 2. Map non-zero business codes to typed errors
class BusinessErrorMiddleware extends OhNetMiddleware {
  readonly name = "business-error"
  readonly leave = async (
    _a,
    ctx: OhNetContext,
    controls: OhNetMiddlewareLeaveControls,
  ): Promise<void> => {
    const body = ctx.response?.data
    if (!isEnvelop(body) || body.code === 0)
      return
    controls.terminate()
    throw new Error(`[${body.code}] ${body.message}`)
  }
}

// 3. Inject access token; on 401, refresh + retry silently
class AuthMiddleware extends OhNetMiddleware {
  readonly name = "auth"

  constructor(
    private readonly getToken: () => string | undefined,
    private readonly refresh: () => Promise<string>,
    private readonly onToken: (t: string) => void,
  ) {
    super()
  }

  readonly enter = async (_a, ctx: OhNetContext): Promise<void> => {
    const token = this.getToken()
    if (token)
      ctx.request.headers.set("Authorization", `Bearer ${token}`)
  }

  readonly leave = async (
    _a,
    ctx: OhNetContext,
    controls: OhNetMiddlewareLeaveControls,
  ): Promise<void> => {
    const body = ctx.response?.data
    if (!isEnvelop(body) || body.code !== 401)
      return
    try {
      this.onToken(await this.refresh())
      controls.retry()
    }
    catch {
      controls.terminate()
      throw new Error("auth refresh failed")
    }
  }
}

// 4. Compose
let token = ""

const client = new OhNetBuilder({ url: "https://api.example.com" })
  .with(new BusinessErrorMiddleware())
  .with(new UnpackMiddleware())
  .with(new AuthMiddleware(
    () => token,
    async () => {
      const session = await fetch("/auth/refresh", { method: "POST" }).then(r => r.json())
      token = session.accessToken
      return token
    },
    (t) => { token = t },
  ))

// 5. Use it
const user = await client.get("/me") // throws on business errors, auto-refreshes on 401
```

The registration order `business-error`, then `unpack`, then `auth` makes the `leave` hooks fire in reverse: `auth` first, then `unpack`, then `business-error`. A `code: 401` triggers the refresh and retry path before `unpack` strips the envelope and before `business-error` throws a typed error.

## Examples

### Streamed download

```ts
const stream = await client
  .append("/files/large")
  .request<ReadableStream>({ responseType: "stream" })

const reader = stream.getReader()
// read in chunks without loading the whole file into memory
```

### Custom retry strategy

```ts
class RetryMiddleware extends OhNetMiddleware {
  readonly name = "retry"
  readonly leave = async (
    _a,
    ctx: OhNetContext,
    controls: OhNetMiddlewareLeaveControls,
  ): Promise<void> => {
    if (ctx.error && (ctx.error as { code?: string }).code === "OHNET_NETWORK")
      controls.retry()
  }
}

const client = new OhNetBuilder({
  url: "https://api.example.com",
  middlewareRetries: 3,
}).with(new RetryMiddleware())
```

### Per-request timeout

```ts
await client.append("/slow-endpoint").request({ method: "GET", timeout: 5_000 })
```

### Cancellation via signal

```ts
const controller = new AbortController()
controller.abort() // before the request even runs

try {
  await client.append("/items").request({ method: "GET", signal: controller.signal })
}
catch (error) {
  // error.code === OHNET_ADAPTER_ERROR_CODE.ABORT
}
```

## API Reference

### Classes

- `OhNetBuilder`: fluent, immutable entry point
- `OhNetMiddleware`: base class for custom middlewares
- `OhNetHeader`: multi-value header collection with RFC 7230 validation
- `OhNetController`: self-contained abort signal
- `OhNetError` / `OhNetInternalError` / `OhNetAdapterError` / `OhNetUnknownError`: error hierarchy

### Types

- `OhNetAdapter`: `(context: OhNetContext) => Promise<OhNetResponse>`
- `OhNetContext` / `OhNetRequest` / `OhNetResponse`
- `OhNetMiddlewareEnterControls` / `OhNetMiddlewareLeaveControls`
- `OhNetEventHandler` / `OhNetEventName`
- `OhNetHeaderLike` / `OhNetHeaderRecord` / `OhNetHeaderEntry` / `OhNetHeaderEntries` / `OhNetHeaderIterable`
- `OhNetSignal`
- `OhNetConfig` / `OhNetRequestConfig` / `OhNetResponseLike`
- `OhNetMethod` / `OhNetParams` / `OhNetResponseType` / `OhNetResponseKind`

### Constants

- `OHNET_EVENT`: 8 lifecycle event names
- `OHNET_ERROR_CODE` / `OHNET_ERROR_MESSAGE` / `OHNET_ERROR_TYPE`
- `OHNET_ADAPTER_ERROR_CODE` / `OHNET_ADAPTER_ERROR_MESSAGE` / `OHNET_ADAPTER_ERROR_TYPE`
- `OHNET_UNKNOWN_ERROR_CODE` / `OHNET_UNKNOWN_ERROR_MESSAGE` / `OHNET_UNKNOWN_ERROR_TYPE`

### Utilities

- `buildQueryString(params)`: encode a query string from `string | Record | Iterable`
- `createResponse(input)`: normalize an adapter response
- `subscribeAbort(signal, listener)`: subscribe to any `OhNetSignal` shape

Full type signatures live in [`./dist/index.d.ts`](./dist/index.d.ts).

## License

ohnet is licensed under a [MIT](./LICENSE)
