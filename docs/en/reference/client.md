---
title: Client
order: 1
---

# {{ $frontmatter.title }}

`OhNetClient` is the entry point. Every configuration call returns a new instance, so a client is safe to share, keep, and derive from. State is strictly immutable: middlewares, events, the request, and the adapter are held as readonly fields, and every mutator (`with` / `clean` / `on` / `off` / `add` / `fork` / `append`) returns a fresh client rather than touching the receiver.

## OhNetClient

```ts
class OhNetClient {
  static create(config?: OhNetConfig): OhNetClient

  fork(options?: {
    adapter?: OhNetAdapter
    context?: OhNetContext
    middlewares?: readonly OhNetMiddleware[]
    events?: ReadonlyMap<OhNetEventName, readonly OhNetEventHandler[]>
  }): OhNetClient
  add(config: OhNetConfig): OhNetClient
  with(middleware: OhNetMiddleware): OhNetClient
  clean(name: string): OhNetClient
  on(event: OhNetEventName, callback: OhNetEventHandler): OhNetClient
  off(event: OhNetEventName, target: OhNetEventHandler): OhNetClient
  append(path: string): OhNetClient

  middlewares(): OhNetMiddlewareQuery
  events(): OhNetEventQuery

  request<T>(config?: OhNetConfig): Promise<T>
  get<T>(path?: string, params?: OhNetParams, data?: unknown): Promise<T>
  post<T>(path?: string, data?: unknown): Promise<T>
  put<T>(path?: string, data?: unknown): Promise<T>
  delete<T>(path?: string, data?: unknown): Promise<T>
  patch<T>(path?: string, data?: unknown): Promise<T>
  head<T>(path?: string, data?: unknown): Promise<T>
  options<T>(path?: string, data?: unknown): Promise<T>
}
```

The four-argument constructor is private and used by [`create`](#createconfig) and [`fork`](#forkoptions) to seed a new instance. Direct invocation is not part of the public API.

### create(config?)

Public entry point for constructing a client. Computes the initial adapter and request from `config`, then seeds an empty middleware/event registry.

| Parameter | Type          | Description                                                                                                        |
| --------- | ------------- | ------------------------------------------------------------------------------------------------------------------ |
| `config`  | `OhNetConfig` | Initial configuration. `url` is the base URL; `adapter` defaults to the built-in `fetchAdapter`. Defaults to `{}`. |

The adapter is stored by reference and is not invoked at construction time, so importing the package in a runtime without `globalThis.fetch` is safe.

### fork(options?)

Returns a new client derived from this one with optional field overrides. Each omitted field is inherited from the receiver; `middlewares` and `events` are copied by default. Acts as a typed wrapper over the private 4-argument constructor.

| Parameter | Type              | Description                                                                             |
| --------- | ----------------- | --------------------------------------------------------------------------------------- |
| `options` | object (optional) | Optional overrides for `adapter`, `context`, `middlewares`, `events`. Defaults to `{}`. |

| Field          | Type                                                        | Description                                                            |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| `adapter?`     | `OhNetAdapter`                                              | Replace the transport. Defaults to the receiver's adapter.             |
| `context?`     | `OhNetContext`                                              | Replace the request context outright. Defaults to the receiver's.      |
| `middlewares?` | `readonly OhNetMiddleware[]`                                | Replace the middleware registry. Defaults to a copy of the receiver's. |
| `events?`      | `ReadonlyMap<OhNetEventName, readonly OhNetEventHandler[]>` | Replace the event registry. Defaults to a copy of the receiver's.      |

### add(config)

Merges `config` into the current request via `resolveRequest` and returns a new client via [`fork({ context })`](#forkoptions). Only request-affecting fields (`url`, `method`, `headers`, `params`, `data`, etc.) apply; to replace middlewares, events, or the adapter, use `fork` directly.

| Parameter | Type          | Description                     |
| --------- | ------------- | ------------------------------- |
| `config`  | `OhNetConfig` | Per-request overrides to merge. |

### with(middleware)

Registers or replaces a middleware by `name`, returning a new client. Registering a middleware whose `name` already exists swaps the implementation in the original slot, preserving order. Throws `OHNET_MIDDLEWARE_NAME` when `name` is empty or whitespace-only.

### clean(name)

Removes every middleware with the given `name`. No-op when none match.

### on(event, callback)

Registers an event handler. Multiple handlers for the same event fire in registration order; handler exceptions are swallowed. See [Middleware and Events](./middleware.md#ohnet_event).

### off(event, target)

Removes every handler that matches `target` by reference.

### append(path)

Returns a client whose URL is the current URL concatenated with `path`. No separator is inserted; include the leading `/` yourself. Existing query strings are preserved.

### middlewares()

Returns a read-only query over the current middleware registry. Each call returns a fresh snapshot of the registry; mutations on the query are not propagated back to the client. See [Middleware Query](#middleware-query) for query methods.

### events()

Returns a read-only query over the current event registry. Each call returns a fresh snapshot; mutations on the query are not propagated back to the client. See [Event Query](#event-query) for query methods.

### Middleware Query

Returned by [`middlewares()`](#middlewares). Snapshot of the current middleware registry with three read-only methods.

| Method      | Type                                             | Description                                                     |
| ----------- | ------------------------------------------------ | --------------------------------------------------------------- |
| `get(name)` | `(name: string) => OhNetMiddleware \| undefined` | First middleware with the given name, or `undefined` when none. |
| `has(name)` | `(name: string) => boolean`                      | Whether a middleware with the given name is registered.         |
| `list()`    | `() => readonly OhNetMiddleware[]`               | Snapshot of the registered middlewares in execution order.      |

### Event Query

Returned by [`events()`](#events). Snapshot of the current event registry with three read-only methods.

| Method         | Type                                                                   | Description                                                                                      |
| -------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `get(event)`   | `(event: OhNetEventName) => readonly OhNetEventHandler[] \| undefined` | Handlers registered for the event, or `undefined` when none. The returned array is a fresh copy. |
| `has(event)`   | `(event: OhNetEventName) => boolean`                                   | Whether the event has any handler registered.                                                    |
| `list(event?)` | `(event?: OhNetEventName) => readonly OhNetEventHandler[]`             | Handlers for a specific event, or every handler across all events when `event` is omitted.       |

### request<T>(config?)

Merges `config` into the current request via `add`, runs the pipeline, and resolves with `response.data` as `T`.

| Parameter | Type          | Description                                       |
| --------- | ------------- | ------------------------------------------------- |
| `config`  | `OhNetConfig` | Optional per-request overrides. Defaults to `{}`. |

**Returns:** `Promise<T>`.

**Throws:** any `OhNetError`. Common codes:

- `OHNET_NO_RESPONSE` when the adapter returned without setting a response and no middleware wrote one.
- `OHNET_SKIPPED` when a middleware skipped and no response was provided.
- `OHNET_RETRY_EXHAUSTED` when middleware retries exceeded `middlewareRetries`.
- Any adapter error (`OHNET_NETWORK` / `OHNET_TIMEOUT` / `OHNET_ABORT` / `OHNET_NO_FETCH`).

### HTTP Verbs

Each verb appends `path` to the current URL and calls `request<T>` with a fixed method. `path`, `params`, and `data` are optional. For `get`, `params` is the query source; for the others, the second argument is the request body.

| Method       | Signature                                                             |
| ------------ | --------------------------------------------------------------------- |
| `get<T>`     | `(path?: string, params?: OhNetParams, data?: unknown) => Promise<T>` |
| `post<T>`    | `(path?: string, data?: unknown) => Promise<T>`                       |
| `put<T>`     | `(path?: string, data?: unknown) => Promise<T>`                       |
| `delete<T>`  | `(path?: string, data?: unknown) => Promise<T>`                       |
| `patch<T>`   | `(path?: string, data?: unknown) => Promise<T>`                       |
| `head<T>`    | `(path?: string, data?: unknown) => Promise<T>`                       |
| `options<T>` | `(path?: string, data?: unknown) => Promise<T>`                       |

`request<T>()` resolves with `response.data`; the generic `T` describes that value.

## OhNetConfig

Top-level configuration accepted by [`create`](#createconfig), [`add`](#addconfig), and [`request`](#request-t-config). Extends [`OhNetRequestConfig`](#ohnetrequestconfig) with an optional transport.

| Property  | Type           | Description                                                        |
| --------- | -------------- | ------------------------------------------------------------------ |
| `adapter` | `OhNetAdapter` | Transport implementation. Defaults to the built-in `fetchAdapter`. |

## OhNetRequestConfig

Partial request configuration. Every field is optional; undefined fields leave the current value untouched.

| Property            | Type                | Description                                                                         |
| ------------------- | ------------------- | ----------------------------------------------------------------------------------- |
| `url`               | `string`            | Target URL. Replaces the client's current URL.                                      |
| `method`            | `OhNetMethod`       | HTTP method. Replaces the current method.                                           |
| `headers`           | `OhNetHeaderLike`   | Headers merged on top of the existing collection (right side wins per name).        |
| `params`            | `OhNetParams`       | Query source. Replaces any previously configured `params`.                          |
| `data`              | `unknown`           | Request body. Forwarded to the adapter as-is.                                       |
| `signal`            | `OhNetSignal`       | External abort signal. Forwarded to the adapter.                                    |
| `timeout`           | `number`            | Timeout in milliseconds. `undefined` disables it.                                   |
| `middlewareRetries` | `number`            | Maximum middleware-driven retries per request. Defaults to `1`.                     |
| `autoRetries`       | `boolean \| number` | Adapter-level auto-retry signal. Forwarded verbatim; semantics are adapter-defined. |
| `responseType`      | `OhNetResponseType` | Body decoding strategy.                                                             |

## Next

- [Middleware and Events](./middleware.md): hooks, controls, and events.
- [Adapter and Context](./transport.md): the request and response types.
- [Errors](./errors.md): error classes and codes.
