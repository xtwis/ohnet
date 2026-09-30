---
title: 测试与模拟适配器
order: 3
---

# {{ $frontmatter.title }}

因为适配器是唯一的传输接缝, 测试可以又快又完全确定: 换掉适配器, 保留整条管线. 没有网络, 没有端口, 没有 flaky.

## 路由表适配器

最小的可用替身把 `"METHOD url"` 映射到预设响应, 并用 `createResponse` 构建它.

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

测试于是只是一个客户端加一张路由表:

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

## 抓取出站请求

包一层 mock 来记录管线实际发出的内容. 适配器看到的是所有 `enter` 钩子执行完之后的 `context.request`, 因此这里是断言 header, body 和查询参数的正确位置.

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

`OhNetHeader` 会把 header 名小写化, 因此用小写 key 比较:

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

## 模拟传输失败

抛出带目标 code 的 `OhNetAdapterError`. catch 处按 `code` 分支, 因此生产和测试走同一条路径.

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

## 测试重试

统计适配器被调用的次数, 并在预算足够之前一直失败. 重试由客户端驱动; 适配器只需要不稳定.

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

降低 `middlewareRetries` 即可断言预算耗尽:

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

## 测试取消

取消由适配器负责, 用 `subscribeAbort` 兼容任意 signal 形态. 当 signal 已经处于 aborted 时它会立即触发, 因此测试没有竞态.

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

## 测试事件

记录生命周期以断言顺序, 或证明某个观察者执行过. 处理器是同步的且异常会被吞掉, 所以一个简单数组就够了.

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

## 模拟适配器还是真实服务器?

| 方式       | 适用场景                                 | 代价                   |
| ---------- | ---------------------------------------- | ---------------------- |
| 模拟适配器 | 中间件, 重试, 事件, 错误映射, 编码       | 响应需要你手写         |
| 本地服务器 | 内置 `fetchAdapter`, 重定向, 真实 header | 更慢; 需要管理生命周期 |

大多数测试都属于第一列. 只有当传输层本身是被测对象时才使用真实服务器, 并把数量控制在一小撮端到端用例. 本仓库的 `test/e2e` 套件两者兼用: 一个 Node `http` 服务器覆盖全栈, 而单元测试保持在适配器层.

## 下一步

- [中间件食谱](./middleware.md): 定义这些测试所验证的中间件.
- [构建业务 API 客户端](./business-client.md): 值得端到端覆盖的流程.
- [链路追踪与指标](./tracing.md): 生产用事件, 测试用数组.
