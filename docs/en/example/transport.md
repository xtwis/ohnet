---
title: Custom Transports
order: 6
---

# {{ $frontmatter.title }}

An adapter is the only place ohnet touches the network. Everything else - builder, middleware, events, retries - works against the same contract, so swapping the transport never changes the rest of the stack.

## The Contract

```ts
type OhNetAdapter = (context: OhNetContext) => Promise<OhNetResponse>
```

Every adapter owns four responsibilities:

1. **Issue** the request using `context.request`.
2. **Resolve** with a normalized response, usually via `createResponse`.
3. **Honor** `context.request.signal` and `context.request.timeout`.
4. **Surface** failures as `OhNetAdapterError` with a code.

The [Adapter guide](../guide/adapter.md) walks through a full `XMLHttpRequest` template. This page shows three other transports: an in-memory store, an axios wrapper, and a WebSocket request/response.

## In-memory Adapter

A store-backed adapter is useful for offline demos, optimistic UI, and deterministic examples. It implements the contract without any I/O.

```ts
import type { OhNetAdapter } from "@xtwis/ohnet"
import { createResponse } from "@xtwis/ohnet"

const store = new Map<string, unknown>()

const memoryAdapter: OhNetAdapter = async (context) => {
  const { url, method, data } = context.request

  if (method === "GET") {
    const value = store.get(url)
    return createResponse({
      status: value === undefined ? 404 : 200,
      headers: {},
      url,
      data: value ?? null,
    })
  }

  if (method === "DELETE") {
    store.delete(url)
    return createResponse({ status: 204, headers: {}, url, data: null })
  }

  store.set(url, data)
  return createResponse({ status: method === "POST" ? 201 : 200, headers: {}, url, data })
}

const client = new OhNetBuilder({ url: "memory://todos", adapter: memoryAdapter })
```

Because the adapter never rejects, no middleware needs to special-case it. Cancellation and timeout are irrelevant for a synchronous store.

## Axios Wrapper

Wrapping an existing client is mostly translation: map `context.request` onto axios options, then map the axios response back onto `OhNetResponse`.

```ts
import type { OhNetAdapter, OhNetContext, OhNetResponse } from "@xtwis/ohnet"
import { createResponse, OHNET_ADAPTER_ERROR_CODE, OhNetAdapterError, OhNetHeader } from "@xtwis/ohnet"
import axios from "axios"

async function axiosAdapter(context: OhNetContext): Promise<OhNetResponse> {
  const { url, method, headers, data, signal, timeout } = context.request
  try {
    const response = await axios.request({
      url,
      method,
      headers: headers.toRecord(),
      data,
      signal,
      timeout,
      // Let non-2xx statuses resolve so ohnet sees the real status.
      validateStatus: () => true,
    })

    return createResponse({
      status: response.status,
      statusText: response.statusText,
      headers: new OhNetHeader(response.headers as Record<string, string>),
      url,
      redirected: false,
      data: response.data,
    })
  }
  catch (error) {
    const code = axios.isCancel(error)
      ? OHNET_ADAPTER_ERROR_CODE.ABORT
      : OHNET_ADAPTER_ERROR_CODE.NETWORK
    throw new OhNetAdapterError(code, `axios: ${String((error as Error).message)}`, undefined, error)
  }
}

const client = new OhNetBuilder({
  url: "https://api.example.com",
  adapter: axiosAdapter,
})
```

This adapter forwards `signal` and `timeout` straight to axios, so cancellation stays consistent with the built-in adapter. It also returns the axios-decoded body, which is fine for JSON APIs; decode other `responseType` values yourself if you need them.

## WebSocket Request/Response

A non-HTTP transport uses the same adapter shape. Correlate each request with an id and resolve the matching response.

```ts
import { subscribeAbort } from "@xtwis/ohnet"

interface WsMessage {
  id: string
  status: number
  body: unknown
}

const socket = new WebSocket("wss://api.example.com")
const pending = new Map<string, (response: OhNetResponse) => void>()

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data as string) as WsMessage
  const resolve = pending.get(message.id)
  if (!resolve)
    return
  pending.delete(message.id)
  resolve(createResponse({
    status: message.status,
    headers: {},
    url: "wss://api.example.com",
    data: message.body,
  }))
})

const websocketAdapter: OhNetAdapter = (context) => {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID()
    pending.set(id, resolve)

    subscribeAbort(context.request.signal, () => {
      pending.delete(id)
      reject(new OhNetAdapterError(OHNET_ADAPTER_ERROR_CODE.ABORT, "aborted"))
    })

    socket.send(JSON.stringify({
      id,
      method: context.request.method,
      url: context.request.url,
      body: context.request.data,
    }))
  })
}
```

`subscribeAbort` fires immediately when the signal is already aborted, so the adapter does not leak a pending entry.

## Mapping Failures

Throw `OhNetAdapterError` with one of the canonical codes, and keep the original cause on `error.error`:

```ts
try {
  // transport call
}
catch (error) {
  throw new OhNetAdapterError(
    OHNET_ADAPTER_ERROR_CODE.NETWORK,
    "adapter: network error",
    undefined,
    error,
  )
}
```

If you throw a plain `Error`, the dispatcher re-wraps it as an `OhNetError` whose `type` and `code` are both `OHNET_UNKNOWN`; the failure is still surfaced, but `code` is no longer meaningful. Throwing `OhNetAdapterError` is what lets catch sites branch on transport failures with `instanceof` plus `code`.

## Next

- [Adapter](../guide/adapter.md): the four responsibilities and the XHR template.
- [Error Handling](../guide/errors.md): the error taxonomy adapters participate in.
- [Testing and Mock Adapters](./testing.md): an adapter is your best test double.
