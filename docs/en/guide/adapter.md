---
title: Adapter
---

# {{ $frontmatter.title }}

The adapter is the transport boundary: the single point where ohnet hands control to a concrete HTTP implementation. Everything else (builder, middleware, events) is transport-agnostic and works against any function matching the `OhNetAdapter` signature.

## The Contract

```ts
type OhNetAdapter = (context: OhNetContext) => Promise<OhNetResponse>
```

That's it. An adapter receives the fully-resolved request from the pipeline and must resolve with an `OhNetResponse` (or reject / throw). Middleware, events, retry semantics, and error mapping stay unchanged when you swap the transport.

## Built-in: `fetchAdapter`

A minimal `fetch`-based adapter ships with the library and is used when no `adapter` is supplied to the constructor. It:

- Bridges the user `signal` through to `AbortController`
- Enforces `request.timeout` via the same signal
- JSON-encodes plain object bodies
- Honors `request.autoRetries` (for `fetch`, this maps to a single retry on network failure)

`fetchAdapter` is a sensible default for any runtime with a standard `fetch` global: modern browsers, Node 18+, Deno, Bun, Cloudflare Workers, Vercel Edge, and similar. If your platform provides `fetch`, you do not need to do anything.

To swap it:

```ts
import { OhNetBuilder } from "@xtwis/ohnet"

const client = new OhNetBuilder({
  url: "https://api.example.com",
  adapter: myAdapter,
})
```

## When to Write Your Own

Typical reasons:

- **No `fetch`**: older Node, embedded JS engines.
- **Non-HTTP transport**: gRPC, WebSocket, in-memory mocks.
- **Legacy SDK**: wrap axios, `XMLHttpRequest`, or a platform-specific client.
- **Test injection**: deterministic failures and latency.

Errors thrown by the adapter flow through the framework's error system unchanged. Throw `OhNetAdapterError` (or let any other error bubble) so catch sites can branch on `OHNET_ADAPTER_ERROR_CODE`. See [Error Handling](./errors.md) for the full taxonomy.

## A Complete XHR Adapter

This `XMLHttpRequest`-based adapter is intentionally small (around 30 lines) and covers the four responsibilities every adapter must own: **issuing the request**, **resolving with the response**, **honoring cancellation**, and **surfacing failures**. Use it as a template when writing your own:

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

## Next

- [Error Handling](./errors.md): the three error classes you can branch on.
- [HTTP Requests](./http.md): `responseType`, `params`, and per-request options.
