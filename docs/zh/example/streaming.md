---
title: 流式与文件传输
order: 5
---

# {{ $frontmatter.title }}

`responseType` 决定适配器如何解码响应 body, `data` 决定请求 body 如何编码. 两者合在一起覆盖了从类型化 JSON 到原始字节流的全部场景.

## `responseType` 矩阵

| 取值            | `response.data` 变为                                        |
| --------------- | ----------------------------------------------------------- |
| `"auto"`        | `content-type` 为 `application/json` 时取 JSON, 否则取 text |
| `"json"`        | `Response.json()`; 解析失败时为 `null`                      |
| `"text"`        | `Response.text()`                                           |
| `"arraybuffer"` | `Response.arrayBuffer()`                                    |
| `"blob"`        | `Response.blob()`                                           |
| `"stream"`      | `Response.body`, 一个 `ReadableStream`                      |
| `"raw"`         | 原生 `Response` 对象                                        |

默认值是 `"auto"`, 对大多数 JSON API 来说是正确的. 按请求覆盖即可:

```ts
const text = await client.append("/readme").request<string>({ responseType: "text" })
const buffer = await client.append("/logo.png").request<ArrayBuffer>({ responseType: "arraybuffer" })
const blob = await client.append("/logo.png").request<Blob>({ responseType: "blob" })
```

因为 `"auto"` 检查响应的 `content-type`, 而不是盲信服务端行为, 它也能防止把 HTML 错误页当成 JSON 解析.

## 流式下载

对超大或无界载荷, 直接要流并分块读取. 除了手里正拿着的那一块, 不会在内存里缓冲任何东西.

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

当文件小到可以放进内存, 并且你想要单个 buffer 时, 把 `responseType: "stream"` 换成 `"arraybuffer"`.

## 检查原始响应

`"raw"` 直接把原生 `Response` 交回来, 于是你可以自己读 status, headers, 重定向和 body. `data` 就是那个 `Response`; 框架不会为你解码任何东西.

```ts
const response = await client
  .append("/items")
  .request<Response>({ responseType: "raw" })

console.log(response.status, response.redirected, response.url)
console.log(response.headers.get("etag"))

if (response.ok)
  await response.json()
```

当自定义适配器暴露了框架未建模的传输能力, 或你需要 `OhNetResponse` 不携带的响应元数据时使用它. 其他情况优先用已解码的类型.

## 请求 Body

适配器根据 `data` 编码请求:

| `data`                                | 发送形式                                            |
| ------------------------------------- | --------------------------------------------------- |
| 纯对象 / 数组                         | JSON, 若缺失则设置 `content-type: application/json` |
| `FormData`                            | multipart, boundary 由运行时设置                    |
| `Blob` / `ArrayBuffer` / `Uint8Array` | 原始字节                                            |
| `string`                              | 原始文本, 不追加 `content-type`                     |
| `URLSearchParams`                     | `application/x-www-form-urlencoded`                 |

```ts
// JSON: 对象 body 会自动序列化
await client.post("/users", { name: "Ada" })

// multipart: 不要自己设置 content-type, boundary 会自动生成
const form = new FormData()
form.append("file", file)
form.append("kind", "avatar")
await client.post("/upload", form)

// 原始字节
await client.put("/files/blob", blob)
```

只有纯对象和数组会被 JSON 编码. 字符串 body 原样发送, 所以当服务端期望特定类型时, 需要自己设置 `content-type`.

## 超时与取消

`timeout` 和 `signal` 由适配器负责, 在默认的 `fetchAdapter` 中, 它们覆盖到响应头到达的那一刻为止. body 解码与流式读取发生在其后, 因此它们不会限制一个缓慢或停滞的 body 花费多久.

对于响应头阶段, 常规规则依然适用:

```ts
const controller = new AbortController()
const client = new OhNetBuilder({ url: BASE, timeout: 5_000 })

const pending = client.append("/slow").request({ signal: controller.signal })
// 在响应头到达前调用 controller.abort() -> OHNET_ABORT
```

当需要在下载中途停止时, 从源头取消: 用 `reader.cancel()` 关闭 reader (它会传播到底层流), 或者编写一个在整个 body 期间都保持 signal 挂接的自定义适配器. 见 [自定义传输层](./transport.md).

## 下一步

- [自定义传输层](./transport.md): 掌控完整 body 生命周期的适配器.
- [中间件食谱](./middleware.md): 大文件下载的缓存与合并.
- [HTTP 请求](../guide/http.md): 完整的请求表面.
