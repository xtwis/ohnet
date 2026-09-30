---
title: Tracing and Metrics
order: 4
---

# {{ $frontmatter.title }}

The lifecycle events are ohnet's observation surface. They fire at fixed points, carry the live `context`, and never change the outcome, which makes them safe for logging, tracing, and metrics.

## The Eight Events

| Event      | Fires                                                      |
| ---------- | ---------------------------------------------------------- |
| `START`    | once per request, before any middleware                    |
| `RETRY`    | at the top of a retry attempt (not the first attempt)      |
| `REQUEST`  | after every `enter` hook, just before the adapter          |
| `RESPONSE` | after the adapter (or a middleware) set `context.response` |
| `SUCCESS`  | terminal: `response` set, `error` null                     |
| `SKIP`     | terminal: the pipeline was short-circuited                 |
| `ERROR`    | terminal: `context.error` is non-null                      |
| `FINISH`   | always last, on every path                                 |

Per attempt the order is `REQUEST`, adapter, `RESPONSE`, leave hooks, then exactly one of `SUCCESS` / `SKIP` / `ERROR`. `RETRY` marks the start of a new attempt and `FINISH` closes the whole request.

## Subscribing

Register handlers with `.on`; each event can have many, and they run in registration order. Every builder method returns a new instance, so assign the result.

```ts
import { OHNET_EVENT, OhNetBuilder } from "@xtwis/ohnet"

const client = new OhNetBuilder({ url: BASE })
  .on(OHNET_EVENT.START, (_, ctx) => console.log("start", ctx.request.url))
  .on(OHNET_EVENT.SUCCESS, (_, ctx) => console.log("ok", ctx.response?.status))
  .on(OHNET_EVENT.ERROR, (_, ctx) => console.error("fail", ctx.error?.code))
  .on(OHNET_EVENT.FINISH, () => console.log("done"))
```

Handlers receive `(adapter, context)`. The adapter argument is `null` when the pipeline was short-circuited before the transport ran.

## Structured Logging

The common pattern is a middleware that puts identity and timing in `context.meta`, plus event handlers that emit one line per outcome.

```ts
import type { OhNetAdapter, OhNetContext } from "@xtwis/ohnet"
import { OhNetMiddleware } from "@xtwis/ohnet"

class ContextMiddleware extends OhNetMiddleware {
  readonly name = "context"

  readonly enter = async (_adapter: OhNetAdapter, context: OhNetContext): Promise<void> => {
    context.meta.requestId = context.request.headers.get("x-request-id") ?? crypto.randomUUID()
    context.meta.startedAt = performance.now()
  }
}

function elapsed(context: OhNetContext): number | undefined {
  const startedAt = context.meta.startedAt as number | undefined
  return startedAt === undefined ? undefined : performance.now() - startedAt
}

function log(level: string, message: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ level, message, ...fields }))
}

function fields(context: OhNetContext): Record<string, unknown> {
  return {
    requestId: context.meta.requestId,
    method: context.request.method,
    url: context.request.url,
    ms: elapsed(context),
  }
}

const client = new OhNetBuilder({ url: BASE })
  .with(new ContextMiddleware())
  .on(OHNET_EVENT.SUCCESS, (_, ctx) => log("info", "request ok", {
    ...fields(ctx),
    status: ctx.response?.status,
  }))
  .on(OHNET_EVENT.ERROR, (_, ctx) => log("error", "request failed", {
    ...fields(ctx),
    code: ctx.error?.code,
  }))
```

`START` fires before middleware runs, so `meta` is still empty there. Record identity and start time in `enter`, then read them from the terminal events.

## Metrics

Count outcomes and collect durations. `FINISH` is the single place that runs on every path, so it is the cleanest hook for a histogram.

```ts
const metrics = {
  requests: 0,
  successes: 0,
  errors: 0,
  skips: 0,
  durations: [] as number[],
}

const client = new OhNetBuilder({ url: BASE })
  .with(new ContextMiddleware())
  .on(OHNET_EVENT.REQUEST, () => { metrics.requests += 1 })
  .on(OHNET_EVENT.SUCCESS, () => { metrics.successes += 1 })
  .on(OHNET_EVENT.ERROR, () => { metrics.errors += 1 })
  .on(OHNET_EVENT.SKIP, () => { metrics.skips += 1 })
  .on(OHNET_EVENT.FINISH, (_, ctx) => {
    const ms = elapsed(ctx)
    if (ms !== undefined)
      metrics.durations.push(ms)
  })
```

Because `requests` is incremented on `REQUEST`, a request that is skipped in `enter` never counts as an attempt. Use `START` instead if you want to count every call, including skips.

## Retries

`RETRY` fires once per re-attempt. The events do not expose a retry counter, so keep your own if you need the number, or read `controls.retryCount` from inside a middleware.

```ts
let retries = 0

const client = new OhNetBuilder({ url: BASE, middlewareRetries: 3 })
  .on(OHNET_EVENT.RETRY, (_, ctx) => {
    retries += 1
    log("warn", "retrying", { url: ctx.request.url, attempt: retries })
  })
```

`SUCCESS` and `ERROR` fire only for the final attempt. Earlier attempts produce `RESPONSE` and then `RETRY`, so pair them if you want per-attempt visibility.

## Events or Middleware?

They overlap, so pick by intent:

| You want to...                                | Use        |
| --------------------------------------------- | ---------- |
| Observe, log, count, trace                    | events     |
| Mutate `request` or `response`                | middleware |
| Short-circuit, retry, or reorder the flow     | middleware |
| Fan out one outcome to several observers      | events     |
| Read or write cross-middleware state (`meta`) | middleware |

A useful rule: if it can change what the caller receives, it belongs in middleware. Events are for the side channel.

## Handler Safety and Removal

Handler exceptions are caught and discarded. A broken observer cannot fail a request, so never signal critical errors from an event handler; write them to `context.error` from a middleware instead.

Remove handlers by reference, not by name:

```ts
import type { OhNetEventHandler } from "@xtwis/ohnet"

const onError: OhNetEventHandler = (_, ctx) => log("error", "failed", { code: ctx.error?.code })

const withHandler = client.on(OHNET_EVENT.ERROR, onError)
const without = withHandler.off(OHNET_EVENT.ERROR, onError)
```

## Next

- [Middleware Recipes](./middleware.md): the mutation side of the same pipeline.
- [Testing and Mock Adapters](./testing.md): assert event order in tests.
- [Pipeline](../guide/pipeline.md): control flow and hook ordering.
