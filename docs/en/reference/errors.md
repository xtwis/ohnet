---
title: Errors
order: 4
---

# {{ $frontmatter.title }}

Every error the library throws is an `OhNetError`. Only two classes are exported: the base `OhNetError` and `OhNetAdapterError`. Internal and unknown failures are identified by `type` and `code` constants.

## OhNetError

```ts
class OhNetError extends Error {
  type: string
  code: string
  message: string
  data?: unknown
  error?: unknown

  constructor(type: string, code: string, message: string, data?: unknown, error?: unknown)
}
```

| Property  | Type      | Description                                                    |
| --------- | --------- | -------------------------------------------------------------- |
| `type`    | `string`  | Coarse classification. One of the `OHNET_*_ERROR_TYPE` values. |
| `code`    | `string`  | Specific failure mode. Branch on this.                         |
| `message` | `string`  | Human-readable description with no prefix.                     |
| `data`    | `unknown` | Optional structured payload. The library never inspects it.    |
| `error`   | `unknown` | Optional underlying cause preserved for logging.               |

`Error.message` is set to `[${code}] ${message}` for stack-trace readability; the raw text is on `this.message`.

## OhNetAdapterError

```ts
class OhNetAdapterError extends OhNetError {
  constructor(code: string, message: string, data?: unknown, error?: unknown)
}
```

An `OhNetError` whose `type` is `OHNET_ADAPTER`. Adapters throw it so catch sites can distinguish transport failures with `instanceof`.

## OHNET_ERROR_TYPE / OHNET_ERROR_CODE / OHNET_ERROR_MESSAGE

Internal framework outcomes.

```ts
const OHNET_ERROR_TYPE = "OHNET_INTERNAL"
```

| Code constant     | Value                   | Meaning                                                            |
| ----------------- | ----------------------- | ------------------------------------------------------------------ |
| `MIDDLEWARE_NAME` | `OHNET_MIDDLEWARE_NAME` | A middleware was registered with an empty or whitespace-only name. |
| `NO_RESPONSE`     | `OHNET_NO_RESPONSE`     | The pipeline finished normally but no response was produced.       |
| `RETRY_EXHAUSTED` | `OHNET_RETRY_EXHAUSTED` | `controls.retry()` was called past `middlewareRetries`.            |
| `SKIPPED`         | `OHNET_SKIPPED`         | A middleware skipped or terminated and no response was written.    |

`OHNET_ERROR_MESSAGE` maps each code to its default message (`"ohnet: ..."`). Messages are advisory; branch on `code`.

## OHNET_ADAPTER_ERROR_TYPE / OHNET_ADAPTER_ERROR_CODE / OHNET_ADAPTER_ERROR_MESSAGE

Transport-level failures.

```ts
const OHNET_ADAPTER_ERROR_TYPE = "OHNET_ADAPTER"
```

| Code constant | Value            | Meaning                                                              |
| ------------- | ---------------- | -------------------------------------------------------------------- |
| `ABORT`       | `OHNET_ABORT`    | The user signal aborted before completion.                           |
| `NETWORK`     | `OHNET_NETWORK`  | The transport rejected the request (DNS, reset, TLS, and so on).     |
| `NO_FETCH`    | `OHNET_NO_FETCH` | The built-in adapter ran where `globalThis.fetch` is not a function. |
| `TIMEOUT`     | `OHNET_TIMEOUT`  | The request exceeded `request.timeout`.                              |

`OHNET_ADAPTER_ERROR_MESSAGE` maps each code to its default message.

## OHNET_UNKNOWN_ERROR_TYPE / OHNET_UNKNOWN_ERROR_CODE / OHNET_UNKNOWN_ERROR_MESSAGE

The dispatcher re-wraps any non-`OhNetError` a middleware or adapter throws.

```ts
const OHNET_UNKNOWN_ERROR_TYPE = "OHNET_UNKNOWN"
const OHNET_UNKNOWN_ERROR_CODE = "OHNET_UNKNOWN"
const OHNET_UNKNOWN_ERROR_MESSAGE = "ohnet: unknown error"
```

The wrapped error carries the original value on `error.error`, and both `type` and `code` are `OHNET_UNKNOWN`, so the structured `code` of the original is lost. Throw an `OhNetError` to keep catch sites branchable.

## Detection Matrix

| `type`           | Produced by                                       | Detect                                    |
| ---------------- | ------------------------------------------------- | ----------------------------------------- |
| `OHNET_INTERNAL` | Framework internals                               | `error.type === OHNET_ERROR_TYPE`         |
| `OHNET_ADAPTER`  | Adapters, including the built-in `fetchAdapter`   | `error instanceof OhNetAdapterError`      |
| `OHNET_UNKNOWN`  | The dispatcher, wrapping a non-`OhNetError` throw | `error.type === OHNET_UNKNOWN_ERROR_TYPE` |

## Next

- [Builder](./builder.md): `request<T>()` throws these.
- [Middleware and Events](./middleware.md): control flow that produces internal codes.
- [Adapter and Context](./transport.md): adapters throw `OhNetAdapterError`.
