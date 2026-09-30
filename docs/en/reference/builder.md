---
title: Builder
order: 1
---

# {{ $frontmatter.title }}

`OhNetBuilder` is the entry point. Every configuration method returns a new builder, so an instance is safe to share, keep, and derive from.

## OhNetBuilder

```ts
class OhNetBuilder {
  constructor(config: OhNetConfig)

  fork(config?: OhNetConfig): OhNetBuilder
  add(config: OhNetConfig): OhNetBuilder
  with(middleware: OhNetMiddleware): OhNetBuilder
  clean(name: string): OhNetBuilder
  on(event: OhNetEventName, callback: OhNetEventHandler): OhNetBuilder
  off(event: OhNetEventName, target: OhNetEventHandler): OhNetBuilder
  append(path: string): OhNetBuilder

  get middleware(): OhNetMiddlewareRegistry
  get event(): OhNetEventRegistry

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

### constructor(config)

| Parameter | Type          | Description                                                                                      |
| --------- | ------------- | ------------------------------------------------------------------------------------------------ |
| `config`  | `OhNetConfig` | Initial configuration. `url` is the base URL; `adapter` defaults to the built-in `fetchAdapter`. |

The adapter is stored by reference and is not invoked at construction time, so importing the package in a runtime without `globalThis.fetch` is safe.

### fork(config?)

Returns a new builder seeded with the current request, middlewares, events, and adapter, then merges `config` over it. The child's `meta` bag is reset to `{}`, so middleware state does not leak between requests. `request` and `response` are copied with cloned headers; `error` is shared by reference.

| Parameter | Type          | Description                           |
| --------- | ------------- | ------------------------------------- |
| `config`  | `OhNetConfig` | Optional overrides. Defaults to `{}`. |

### add(config)

Alias of [`fork`](#forkconfig) that requires a config. Behavior is identical.

### with(middleware)

Registers or replaces a middleware by `name`, returning a new builder. Registering a middleware whose `name` already exists swaps the implementation in the original slot, preserving order. Throws `OHNET_MIDDLEWARE_NAME` when `name` is empty or whitespace-only.

### clean(name)

Removes every middleware with the given `name`. No-op when none match.

### on(event, callback)

Registers an event handler. Multiple handlers for the same event fire in registration order; handler exceptions are swallowed. See [Middleware and Events](./middleware.md#ohnet_event).

### off(event, target)

Removes every handler that matches `target` by reference.

### append(path)

Returns a builder whose URL is the current URL concatenated with `path`. No separator is inserted; include the leading `/` yourself. Existing query strings are preserved.

### middleware

Returns the middleware registry. The registry type is not exported; its useful members are `list(): OhNetMiddleware[]`, `has(name: string): boolean`, and `get(name: string): OhNetMiddleware | undefined`.

### event

Returns the event registry. The registry type is not exported; its useful member is `list(event?: OhNetEventName): readonly OhNetEventHandler[]`.

### request<T>(config?)

Runs the pipeline and resolves with `response.data` as `T`.

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

Top-level configuration accepted by the constructor and by `fork` / `add` / `request`. Extends [`OhNetRequestConfig`](#ohnetrequestconfig) with an optional transport.

| Property  | Type           | Description                                                        |
| --------- | -------------- | ------------------------------------------------------------------ |
| `adapter` | `OhNetAdapter` | Transport implementation. Defaults to the built-in `fetchAdapter`. |

## OhNetRequestConfig

Partial request configuration. Every field is optional; undefined fields leave the current value untouched.

| Property            | Type                | Description                                                                         |
| ------------------- | ------------------- | ----------------------------------------------------------------------------------- |
| `url`               | `string`            | Target URL. Replaces the builder's current URL.                                     |
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
