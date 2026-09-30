---
title: Adapter and Context
order: 3
---

# {{ $frontmatter.title }}

The adapter is the transport boundary. The context is the mutable state threaded through a single request.

## OhNetAdapter

```ts
type OhNetAdapter = (context: OhNetContext) => Promise<OhNetResponse>
```

Receives the fully-resolved context and returns a normalized response. An adapter owns four responsibilities: issue the request, resolve with an `OhNetResponse`, honor `signal` and `timeout`, and surface failures as `OhNetAdapterError`.

Errors thrown by an adapter reach `context.error`: an `OhNetError` is preserved as-is, anything else is re-wrapped with type and code `OHNET_UNKNOWN`.

## OhNetContext

```ts
interface OhNetContext {
  request: OhNetRequest
  response: OhNetResponse | null
  error: OhNetError | null
  meta: Record<string | symbol, unknown>
}
```

| Property   | Type                                | Description                                                                        |
| ---------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| `request`  | `OhNetRequest`                      | The resolved request. Mutable until the adapter runs.                              |
| `response` | `OhNetResponse \| null`             | Adapter result. `null` before the adapter runs and after a skip or error path.     |
| `error`    | `OhNetError \| null`                | Adapter or middleware error. Checked before `response` when resolving the outcome. |
| `meta`     | `Record<string \| symbol, unknown>` | Open per-request bag for middleware-to-middleware state. Symbol keys are allowed.  |

## OhNetRequest

```ts
interface OhNetRequest {
  url: string
  method: OhNetMethod
  headers: OhNetHeader
  params?: OhNetParams
  data?: unknown
  signal?: OhNetSignal
  timeout?: number
  middlewareRetries?: number
  autoRetries?: boolean | number
  responseType: OhNetResponseType
}
```

| Property            | Type                | Description                                                     |
| ------------------- | ------------------- | --------------------------------------------------------------- |
| `url`               | `string`            | Target URL. May already contain a query string.                 |
| `method`            | `OhNetMethod`       | HTTP method.                                                    |
| `headers`           | `OhNetHeader`       | Outgoing headers. Always an instance, never `null`.             |
| `params`            | `OhNetParams`       | Query source. `undefined` means no query is appended.           |
| `data`              | `unknown`           | Request body. The adapter decides how to serialize it.          |
| `signal`            | `OhNetSignal`       | External abort signal.                                          |
| `timeout`           | `number`            | Timeout in milliseconds.                                        |
| `middlewareRetries` | `number`            | Middleware retry cap. Defaults to `1`.                          |
| `autoRetries`       | `boolean \| number` | Adapter-level auto-retry signal. Semantics are adapter-defined. |
| `responseType`      | `OhNetResponseType` | Body decoding strategy.                                         |

## OhNetResponse

```ts
interface OhNetResponse<T = unknown> {
  status: number
  statusText: string
  ok: boolean
  headers: OhNetHeader
  url: string
  redirected: boolean
  type: OhNetResponseKind
  data: T
  body?: unknown
}
```

| Property     | Type                | Description                                                                  |
| ------------ | ------------------- | ---------------------------------------------------------------------------- |
| `status`     | `number`            | HTTP status code.                                                            |
| `statusText` | `string`            | HTTP status text. Empty string when the transport did not provide one.       |
| `ok`         | `boolean`           | True when `status` is in the 200-299 range, unless the adapter overrides it. |
| `headers`    | `OhNetHeader`       | Response headers.                                                            |
| `url`        | `string`            | Final URL after redirects.                                                   |
| `redirected` | `boolean`           | True if the response came from at least one redirect.                        |
| `type`       | `OhNetResponseKind` | Response classification, mirroring the Fetch specification.                  |
| `data`       | `T`                 | Decoded body. Type depends on `T` and the request `responseType`.            |
| `body`       | `unknown`           | Raw transport object when an adapter chooses to expose it.                   |

## createResponse

```ts
function createResponse<T>(input: OhNetResponseLike<T>): OhNetResponse<T>
```

Normalizes a loose adapter response into `OhNetResponse`. Fills defaults: `statusText` becomes `""`, `ok` becomes `status` in the 200-299 range, `redirected` becomes `false`, `type` becomes `"default"`. The header collection is rebuilt, so the result does not share storage with the input.

## OhNetResponseLike

```ts
interface OhNetResponseLike<T = unknown> {
  status: number
  headers: OhNetHeaderLike
  url: string
  statusText?: string
  ok?: boolean
  redirected?: boolean
  type?: OhNetResponseKind
  data?: T
  body?: unknown
}
```

Loose shape adapters may return to `createResponse`. `status`, `headers`, and `url` are required; the rest are synthesized when omitted.

## OhNetMethod

```ts
type OhNetMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS"
```

## OhNetParams

```ts
type OhNetParams
  = | string
    | Record<string, unknown>
    | Iterable<readonly [string, string]>
```

| Shape                        | Behavior                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `string`                     | Used verbatim, with a leading `?` stripped.                                                    |
| `Record<string, unknown>`    | URL-encoded in insertion order; arrays become repeated keys; `null` / `undefined` are skipped. |
| `Iterable<[string, string]>` | Raw pair iteration, preserving order and duplicates.                                           |

## OhNetResponseType

```ts
type OhNetResponseType = "auto" | "json" | "text" | "arraybuffer" | "blob" | "stream" | "raw"
```

| Value           | Body becomes                                                    |
| --------------- | --------------------------------------------------------------- |
| `"auto"`        | JSON when `content-type` is `application/json`, otherwise text. |
| `"json"`        | `Response.json()`; `null` on parse failure.                     |
| `"text"`        | `Response.text()`.                                              |
| `"arraybuffer"` | `Response.arrayBuffer()`.                                       |
| `"blob"`        | `Response.blob()`.                                              |
| `"stream"`      | `Response.body`, a `ReadableStream`.                            |
| `"raw"`         | The native `Response` object.                                   |

## OhNetResponseKind

```ts
type OhNetResponseKind = "basic" | "cors" | "default" | "error" | "opaque" | "opaqueredirect"
```

Mirrors the Fetch specification's `Response.type`.

## buildQueryString

```ts
function buildQueryString(params: OhNetParams): string
```

Serializes any `OhNetParams` shape into an encoded query string with no leading `?`. A `string` input is returned after stripping one leading `?`. An iterable is consumed as `[name, value]` pairs; a record is iterated in insertion order. Arrays expand into repeated keys; `null` and `undefined` values are skipped.

```ts
buildQueryString({ page: 2, tag: ["a", "b"] }) // "page=2&tag=a&tag=b"
buildQueryString("?raw=1") // "raw=1"
```

## Next

- [Builder](./builder.md): how a request is assembled.
- [Middleware and Events](./middleware.md): what runs around the adapter.
- [Headers](./header.md): the `OhNetHeader` collection used by requests and responses.
