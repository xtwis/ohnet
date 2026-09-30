---
title: 适配器
order: 5
---

# {{ $frontmatter.title }}

适配器是传输层边界: ohnet 把控制权移交给具体 HTTP 实现的唯一接触点. 其他所有部件 (builder, middleware, events) 都是传输无关的, 它们针对任何匹配该签名的函数工作.

## 契约

```ts
type OhNetAdapter = (context: OhNetContext) => Promise<OhNetResponse>
```

就这些. 适配器从管线拿到完整解析后的 `context.request`, 并必须以 `OhNetResponse` resolve (或 reject / throw). 当你切换传输时, 中间件, 事件, 重试语义与错误映射都保持不变.

## 内置: `fetchAdapter`

库内自带一个最小的基于 `fetch` 的适配器, 在没传 `adapter` 时使用. 它:

- 把用户 `signal` 桥接到 `AbortController`
- 通过同一个 signal 强制 `request.timeout`
- 对纯对象 body 自动 JSON 编码
- 遵守 `request.autoRetries`: 传 `true` 时, 幂等方法 (`GET`, `HEAD`, `OPTIONS`, `PUT`, `DELETE`) 在网络失败或超时时最多重试 3 次; 传正数则设置重试上限 (最大 3). 重试间隔 300ms.

`fetchAdapter` 适合任何暴露标准 `fetch` 全局的运行时: 现代浏览器, Node 18+, Deno, Bun, Cloudflare Workers, Vercel Edge 等. 只要平台提供 `fetch`, 无需额外配置.

要替换它:

```ts
import { OhNetBuilder } from "@xtwis/ohnet"

const client = new OhNetBuilder({
  url: "https://api.example.com",
  adapter: myAdapter,
})
```

## 何时编写自定义

常见原因:

- **没有 `fetch`**: 老版 Node, 嵌入式 JS 引擎.
- **非 HTTP 传输**: gRPC, WebSocket, 内存 mock.
- **遗留 SDK**: 包装 axios, `XMLHttpRequest`, 或平台特定的客户端.
- **测试注入**: 确定性的失败与延迟.

适配器抛出的错误会原样穿过框架的错误体系. 抛 `OhNetAdapterError` (或让任何其他错误冒泡) 以便 catch 处按 `OHNET_ADAPTER_ERROR_CODE` 分支. 完整的分类见 [错误处理](./errors.md).

## 完整的 XHR 适配器

这个基于 `XMLHttpRequest` 的适配器刻意保持精简 (约 30 行), 覆盖每个适配器必须承担的四个职责: **发起请求**, **解析响应**, **响应取消**, **暴露失败**. 编写自定义适配器时可直接套用:

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

同样的形态适用于任何传输与运行时: gRPC, WebSocket, 内存 mock, axios 包装, 遗留 SDK. 实现这四个职责, 抛 `OhNetAdapterError` 并使用合适的 code, 框架的其余部分 (middleware, events, retries) 都会照常工作.

## 下一步

- [错误处理](./errors.md): 你可以基于其分支的三层错误类.
- [HTTP Requests](./http.md): `responseType`, `params`, 以及每请求选项.
