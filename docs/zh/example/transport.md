---
title: 自定义传输层
order: 6
---

# {{ $frontmatter.title }}

适配器是 ohnet 唯一触碰网络的地方. 其他一切 - builder, 中间件, 事件, 重试 - 都针对同一份契约工作, 因此替换传输层永远不会改变栈的其余部分.

## 契约

```ts
type OhNetAdapter = (context: OhNetContext) => Promise<OhNetResponse>
```

每个适配器都承担四项职责:

1. 用 `context.request` **发起**请求.
2. 用规范化的响应 **resolve**, 通常借助 `createResponse`.
3. **遵守** `context.request.signal` 和 `context.request.timeout`.
4. 以带 code 的 `OhNetAdapterError` **暴露**失败.

[适配器指南](../guide/adapter.md) 完整走了一遍 `XMLHttpRequest` 模板. 本页展示另外三种传输: 内存存储, axios 包装, 以及 WebSocket 请求/响应.

## 内存适配器

基于存储的适配器适合离线演示, 乐观 UI, 以及确定性示例. 它不涉及任何 I/O 就实现了契约.

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

因为适配器从不 reject, 没有中间件需要为它特判. 对同步存储而言, 取消和超时都无关紧要.

## 包装 Axios

包装已有客户端主要是翻译工作: 把 `context.request` 映射成 axios 选项, 再把 axios 响应映射回 `OhNetResponse`.

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
      // 让非 2xx 状态正常返回, 以便 ohnet 看到真实状态码.
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

该适配器把 `signal` 和 `timeout` 直接转交给 axios, 因此取消行为与内置适配器保持一致. 它也直接返回 axios 解码后的 body, 对 JSON API 来说足够; 其他 `responseType` 取值需要你自己解码.

## WebSocket 请求/响应

非 HTTP 传输使用相同的适配器形态. 用 id 关联每个请求, 并 resolve 匹配到的响应.

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

当 signal 已经处于 aborted 时 `subscribeAbort` 会立即触发, 因此适配器不会泄漏 pending 条目.

## 映射失败

抛出带规范 code 的 `OhNetAdapterError`, 并把原始原因保留在 `error.error`:

```ts
try {
  // 传输调用
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

如果你抛的是普通 `Error`, 调度器会把它重新包装为 `type` 和 `code` 均为 `OHNET_UNKNOWN` 的 `OhNetError`; 失败仍会浮出, 但 `code` 失去意义. 抛 `OhNetAdapterError` 才能让 catch 处用 `instanceof` 加 `code` 区分传输失败.

## 下一步

- [适配器](../guide/adapter.md): 四项职责与 XHR 模板.
- [错误处理](../guide/errors.md): 适配器参与的错误分类.
- [测试与模拟适配器](./testing.md): 适配器是你最好的测试替身.
