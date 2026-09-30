---
title: Streaming and File Transfers
order: 5
---

# {{ $frontmatter.title }}

`responseType` controls how the adapter decodes the body, and `data` controls how the request body is encoded. Together they cover everything from typed JSON to a raw byte stream.

## The `responseType` Matrix

| Value           | `response.data` becomes                                   |
| --------------- | --------------------------------------------------------- |
| `"auto"`        | JSON when `content-type` is `application/json`, else text |
| `"json"`        | `Response.json()`; `null` when parsing fails              |
| `"text"`        | `Response.text()`                                         |
| `"arraybuffer"` | `Response.arrayBuffer()`                                  |
| `"blob"`        | `Response.blob()`                                         |
| `"stream"`      | `Response.body`, a `ReadableStream`                       |
| `"raw"`         | the native `Response` object                              |

The default is `"auto"`, which is right for most JSON APIs. Override it per request:

```ts
const text = await client.append("/readme").request<string>({ responseType: "text" })
const buffer = await client.append("/logo.png").request<ArrayBuffer>({ responseType: "arraybuffer" })
const blob = await client.append("/logo.png").request<Blob>({ responseType: "blob" })
```

Because `"auto"` checks the response `content-type` rather than trusting the server's behavior, it also protects you from an HTML error page being parsed as JSON.

## Streamed Downloads

For large or unbounded payloads, ask for the stream and read it in chunks. Nothing is buffered in memory beyond the chunk you are holding.

```ts
const stream = await client
  .append("/files/large")
  .request<ReadableStream<Uint8Array>>({ responseType: "stream" })

const reader = stream.getReader()
try {
  while (true) {
    const { done, value } = await reader.read()
    if (done)
      break
    await sink.write(value)
  }
}
finally {
  reader.releaseLock()
}
```

Swap `responseType: "stream"` for `"arraybuffer"` when the file is small enough to fit in memory and you want a single buffer.

## Inspecting the Raw Response

`"raw"` hands back the native `Response`, so you can read status, headers, redirects, and the body yourself. `data` is the `Response`; nothing is decoded for you.

```ts
const response = await client
  .append("/items")
  .request<Response>({ responseType: "raw" })

console.log(response.status, response.redirected, response.url)
console.log(response.headers.get("etag"))

if (response.ok)
  await response.json()
```

Use it when a custom adapter exposes transport features the framework does not model, or when you need response metadata that `OhNetResponse` does not carry. Otherwise prefer the decoded types.

## Request Bodies

The adapter encodes the request based on `data`:

| `data`                                | Sent as                                                   |
| ------------------------------------- | --------------------------------------------------------- |
| plain object / array                  | JSON, with `content-type: application/json` set if absent |
| `FormData`                            | multipart, boundary set by the runtime                    |
| `Blob` / `ArrayBuffer` / `Uint8Array` | raw bytes                                                 |
| `string`                              | raw text, no `content-type` added                         |
| `URLSearchParams`                     | `application/x-www-form-urlencoded`                       |

```ts
// JSON: object bodies are serialized for you
await client.post("/users", { name: "Ada" })

// Multipart: do not set content-type yourself, the boundary is generated
const form = new FormData()
form.append("file", file)
form.append("kind", "avatar")
await client.post("/upload", form)

// Raw bytes
await client.put("/files/blob", blob)
```

Only plain objects and arrays are JSON-encoded. A string body is sent as-is, so set `content-type` yourself when the server expects a specific type.

## Timeouts and Cancellation

`timeout` and `signal` are enforced by the adapter, and in the default `fetchAdapter` they cover the request up to the moment response headers arrive. Body decoding and streaming happen afterwards, so they do not bound how long a slow or stalled body takes.

For the header phase the usual rules apply:

```ts
const controller = new AbortController()
const client = new OhNetBuilder({ url: BASE, timeout: 5_000 })

const pending = client.append("/slow").request({ signal: controller.signal })
// controller.abort() before the headers arrive -> OHNET_ABORT
```

When you need to stop a download mid-stream, cancel it at the source: close the reader with `reader.cancel()` (which propagates to the underlying stream), or write a custom adapter that keeps the signal attached for the whole body. See [Custom Transports](./transport.md) for adapters that own their cancellation.

## Next

- [Custom Transports](./transport.md): adapters that control the full body lifecycle.
- [Middleware Recipes](./middleware.md): caching and coalescing large downloads.
- [HTTP Requests](../guide/http.md): the full request surface.
