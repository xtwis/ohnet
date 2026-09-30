---
title: Testing and Mock Adapters
order: 3
---

# {{ $frontmatter.title }}

Because the adapter is the only transport seam, tests can be fast and fully deterministic: swap the adapter, keep the entire pipeline. No network, no ports, no flakiness.

## A Route-Table Adapter

The smallest useful double maps `"METHOD url"` to a canned response and builds it with `createResponse`.

```ts
import type { OhNetAdapter } from "@xtwis/ohnet"
import { createResponse, OHNET_ADAPTER_ERROR_CODE, OhNetAdapterError } from "@xtwis/ohnet"

interface Route {
  status?: number
  headers?: Record<string, string>
  data?: unknown
}

function mockAdapter(routes: Record<string, Route>): OhNetAdapter {
  return async (context) => {
    const key = `${context.request.method} ${context.request.url}`
    const route = routes[key]
    if (!route) {
      throw new OhNetAdapterError(
        OHNET_ADAPTER_ERROR_CODE.NETWORK,
        `no route for ${key}`,
      )
    }
    return createResponse({
      status: route.status ?? 200,
      headers: route.headers ?? {},
      url: context.request.url,
      data: route.data,
    })
  }
}
```

A test is then just a client plus a route table:

```ts
import { OhNetBuilder } from "@xtwis/ohnet"
import { describe, expect, it } from "vitest"

const BASE = "https://api.example.com"

describe("user api", () => {
  it("returns the payload", async () => {
    const client = new OhNetBuilder({
      url: BASE,
      adapter: mockAdapter({
        [`GET ${BASE}/users/1`]: { data: { id: "1", name: "Ada" } },
      }),
    })

    await expect(client.get("/users/1")).resolves.toEqual({ id: "1", name: "Ada" })
  })
})
```

## Capturing Outgoing Requests

Wrap the mock to record what the pipeline actually sent. The adapter sees `context.request` after every `enter` hook, so this is the right place to assert on headers, body, and query.

```ts
interface CapturedRequest {
  method: string
  url: string
  headers: Record<string, string>
  data: unknown
}

function capturingAdapter(inner: OhNetAdapter, calls: CapturedRequest[]): OhNetAdapter {
  return async (context) => {
    calls.push({
      method: context.request.method,
      url: context.request.url,
      headers: context.request.headers.toRecord(),
      data: context.request.data,
    })
    return inner(context)
  }
}
```

Header names are lowercased by `OhNetHeader`, so compare against lowercase keys:

```ts
it("attaches the bearer token", async () => {
  const calls: CapturedRequest[] = []
  const client = new OhNetBuilder({
    url: BASE,
    adapter: capturingAdapter(mockAdapter({ [`GET ${BASE}/me`]: { data: null } }), calls),
  }).with(new TokenMiddleware(() => "secret"))

  await client.get("/me")

  expect(calls).toHaveLength(1)
  expect(calls[0].headers.authorization).toBe("Bearer secret")
})
```

## Simulating Transport Failures

Throw `OhNetAdapterError` with the code under test. Catch sites branch on `code`, so production and tests take the same path.

```ts
function failingAdapter(code: string): OhNetAdapter {
  return async () => {
    throw new OhNetAdapterError(code, `simulated ${code}`)
  }
}

it("surfaces a network failure", async () => {
  const client = new OhNetBuilder({
    url: BASE,
    adapter: failingAdapter(OHNET_ADAPTER_ERROR_CODE.NETWORK),
  })

  await expect(client.get("/items")).rejects.toMatchObject({
    type: "OHNET_ADAPTER",
    code: OHNET_ADAPTER_ERROR_CODE.NETWORK,
  })
})
```

## Testing Retries

Count adapter invocations and fail until the retry budget is enough. The client drives retries; the adapter only needs to be flaky.

```ts
class RetryOnNetworkMiddleware extends OhNetMiddleware {
  readonly name = "retry-net"

  readonly leave = async (
    _adapter: OhNetAdapter,
    context: OhNetContext,
    controls: OhNetMiddlewareLeaveControls,
  ): Promise<void> => {
    const code = (context.error as { code?: string } | null)?.code
    if (code === OHNET_ADAPTER_ERROR_CODE.NETWORK)
      controls.retry()
  }
}

it("retries until the third attempt succeeds", async () => {
  let attempts = 0
  const adapter: OhNetAdapter = async (context) => {
    attempts += 1
    if (attempts < 3)
      throw new OhNetAdapterError(OHNET_ADAPTER_ERROR_CODE.NETWORK, "flaky")
    return createResponse({ status: 200, headers: {}, url: context.request.url, data: "ok" })
  }

  const client = new OhNetBuilder({ url: BASE, adapter, middlewareRetries: 3 })
    .with(new RetryOnNetworkMiddleware())

  await expect(client.get("/flaky")).resolves.toBe("ok")
  expect(attempts).toBe(3)
})
```

Lower `middlewareRetries` to assert exhaustion instead:

```ts
it("fails once the retry budget is spent", async () => {
  const client = new OhNetBuilder({
    url: BASE,
    adapter: failingAdapter(OHNET_ADAPTER_ERROR_CODE.NETWORK),
    middlewareRetries: 1,
  }).with(new RetryOnNetworkMiddleware())

  await expect(client.get("/flaky")).rejects.toMatchObject({
    code: "OHNET_RETRY_EXHAUSTED",
  })
})
```

## Testing Cancellation

An adapter owns cancellation, using `subscribeAbort` to honor any signal shape. It fires immediately when the signal is already aborted, so the test has no race.

```ts
import { subscribeAbort } from "@xtwis/ohnet"

const slowAdapter: OhNetAdapter = (context) => {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>
    const unsubscribe = subscribeAbort(context.request.signal, () => {
      clearTimeout(timer)
      reject(new OhNetAdapterError(OHNET_ADAPTER_ERROR_CODE.ABORT, "aborted"))
    })
    timer = setTimeout(() => {
      unsubscribe()
      resolve(createResponse({ status: 200, headers: {}, url: context.request.url, data: "late" }))
    }, 1_000)
  })
}

it("rejects with OHNET_ABORT", async () => {
  const controller = new AbortController()
  const client = new OhNetBuilder({ url: BASE, adapter: slowAdapter })

  const pending = client.append("/slow").request({ signal: controller.signal })
  controller.abort()

  await expect(pending).rejects.toMatchObject({ code: OHNET_ADAPTER_ERROR_CODE.ABORT })
})
```

## Testing Events

Record the lifecycle to assert ordering or to prove an observer ran. Handlers are synchronous and exceptions are swallowed, so a simple array is enough.

```ts
import { OHNET_EVENT } from "@xtwis/ohnet"

it("emits lifecycle events in order", async () => {
  const seen: string[] = []
  const client = new OhNetBuilder({
    url: BASE,
    adapter: mockAdapter({ [`GET ${BASE}/items`]: { data: [] } }),
  })
    .on(OHNET_EVENT.START, () => seen.push("start"))
    .on(OHNET_EVENT.REQUEST, () => seen.push("request"))
    .on(OHNET_EVENT.RESPONSE, () => seen.push("response"))
    .on(OHNET_EVENT.SUCCESS, () => seen.push("success"))
    .on(OHNET_EVENT.FINISH, () => seen.push("finish"))

  await client.get("/items")

  expect(seen).toEqual(["start", "request", "response", "success", "finish"])
})
```

## Mock Adapter or Real Server?

| Approach     | Use it for                                           | Trade-off                          |
| ------------ | ---------------------------------------------------- | ---------------------------------- |
| Mock adapter | middleware, retries, events, error mapping, encoding | You write the response by hand     |
| Local server | the built-in `fetchAdapter`, redirects, real headers | Slower; needs lifecycle management |

Most tests belong in the first column. Reach for a real server only when the transport itself is under test, and keep it to a few end-to-end cases. The `test/e2e` suite in this repository combines both: a Node `http` server exercises the whole stack, while the unit tests stay adapter-level.

## Next

- [Middleware Recipes](./middleware.md): define the middleware these tests exercise.
- [Building a Business API Client](./business-client.md): the flow worth covering end to end.
- [Tracing](./tracing.md): events for production, arrays in tests.
