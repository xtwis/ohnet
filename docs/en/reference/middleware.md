---
title: Middleware and Events
order: 2
---

# {{ $frontmatter.title }}

Middleware hooks run around the adapter; lifecycle events observe the pipeline. Both are registered on the builder.

## OhNetMiddleware

```ts
abstract class OhNetMiddleware {
  abstract readonly name: string
  enter?(adapter: OhNetAdapter, context: OhNetContext, controls: OhNetMiddlewareEnterControls): Promise<void>
  leave?(adapter: OhNetAdapter, context: OhNetContext, controls: OhNetMiddlewareLeaveControls): Promise<void>
}
```

| Member  | Type     | Description                                                                         |
| ------- | -------- | ----------------------------------------------------------------------------------- |
| `name`  | `string` | Stable identifier used by `with`, `clean`, and replacement. Must be non-whitespace. |
| `enter` | method   | Optional. Runs before the adapter, in registration order.                           |
| `leave` | method   | Optional. Runs after the adapter, in reverse registration order.                    |

Exceptions thrown inside a hook are caught by the dispatcher and assigned to `context.error`. Throw `OhNetError` directly to preserve `type` and `code`; anything else is re-wrapped with type and code `OHNET_UNKNOWN`.

## OhNetMiddlewareEnterControls

Passed as the third argument of `enter`.

| Member        | Type         | Description                                                                                                                                                                    |
| ------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `skip()`      | `() => void` | Adapter does not run. Later `enter` hooks are skipped; the `leave` chain still runs. Ends with `OHNET_SKIPPED` unless `context.response` is set, in which case `SUCCESS` wins. |
| `terminate()` | `() => void` | Stops later `enter` hooks and suppresses the entire `leave` chain.                                                                                                             |
| `retry()`     | `() => void` | Re-runs the whole pipeline. Capped at `request.middlewareRetries`.                                                                                                             |
| `retryCount`  | `number`     | Retries before this hook runs; `0` on the first attempt. Read-only.                                                                                                            |

Calling `skip`, `terminate`, or `retry` only sets a flag; the dispatcher reads it after the hook returns. The first call wins.

## OhNetMiddlewareLeaveControls

Passed as the third argument of `leave`. There is no `skip` on the way out.

| Member        | Type         | Description                                                         |
| ------------- | ------------ | ------------------------------------------------------------------- |
| `terminate()` | `() => void` | Stops the rest of the `leave` chain.                                |
| `retry()`     | `() => void` | Re-runs the whole pipeline. Capped at `request.middlewareRetries`.  |
| `retryCount`  | `number`     | Retries before this hook runs; `0` on the first attempt. Read-only. |

## OHNET_EVENT

Constant object mapping event names to their string values.

```ts
const OHNET_EVENT = {
  START: "on_start",
  RETRY: "on_retry",
  REQUEST: "on_request",
  RESPONSE: "on_response",
  SUCCESS: "on_success",
  SKIP: "on_skip",
  ERROR: "on_error",
  FINISH: "on_finish",
} as const
```

| Event      | Fires                                                     |
| ---------- | --------------------------------------------------------- |
| `START`    | Once per request, before any middleware.                  |
| `RETRY`    | At the top of a retry attempt (not the first attempt).    |
| `REQUEST`  | After every `enter` hook, just before the adapter.        |
| `RESPONSE` | After the adapter or a middleware set `context.response`. |
| `SUCCESS`  | Terminal: `response` set, `error` null.                   |
| `SKIP`     | Terminal: the pipeline was short-circuited.               |
| `ERROR`    | Terminal: `context.error` is non-null.                    |
| `FINISH`   | Always last, on every path.                               |

Per attempt the order is `REQUEST`, adapter, `RESPONSE`, leave hooks, then exactly one of `SUCCESS` / `SKIP` / `ERROR`. `RETRY` marks a re-attempt; `FINISH` closes the whole request.

## OhNetEventName

```ts
type OhNetEventName = (typeof OHNET_EVENT)[keyof typeof OHNET_EVENT]
```

Union of the eight event name strings.

## OhNetEventHandler

```ts
type OhNetEventHandler = (adapter: OhNetAdapter, context: OhNetContext) => void
```

Registered with `builder.on`. Handlers run in registration order. `adapter` is `null` when the pipeline was short-circuited before the transport ran. Handler exceptions are caught and discarded, so they never affect the outcome.

## Next

- [Builder](./builder.md): where middlewares and handlers are registered.
- [Adapter and Context](./transport.md): the `context` hooks receive.
- [Errors](./errors.md): codes produced by the control flow.
