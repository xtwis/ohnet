---
title: 中间件食谱
order: 2
---

# {{ $frontmatter.title }}

中间件是请求策略所在之处: 添加 header, 短路, 重试, 缓存. 本页是一份可直接搬进项目的食谱集. 每个食谱都自成一体, 用 `.with(...)` 组合即可.

每个钩子都收到同一个 `context`, 外加一个 `controls` 对象:

| 钩子    | 运行时机           | 可用控制                     |
| ------- | ------------------ | ---------------------------- |
| `enter` | 适配器之前, 按顺序 | `skip`, `terminate`, `retry` |
| `leave` | 适配器之后, 逆序   | `terminate`, `retry`         |

`context.meta` 是每请求的状态袋, 每次 `fork` 都会重置. 某个中间件写入的值对下一个中间件可见, 下面的食谱正是用它在自己的 `leave` 里取回数据.

## 请求 id

给每个请求盖上关联 id, 并存进 `meta`, 以便日志中间件稍后读取.

```ts
import type { OhNetAdapter, OhNetContext } from "@xtwis/ohnet"
import { OhNetMiddleware } from "@xtwis/ohnet"

class RequestIdMiddleware extends OhNetMiddleware {
  readonly name = "request-id"

  readonly enter = async (_adapter: OhNetAdapter, context: OhNetContext): Promise<void> => {
    const id = context.request.headers.get("x-request-id") ?? crypto.randomUUID()
    context.request.headers.set("x-request-id", id)
    context.meta.requestId = id
  }
}
```

## 计时

测量适配器往返耗时. 在 `enter` 记录起点, 在 `leave` 计算差值, 这样就把中间件自身的工作排除在数字之外, 通常这正是你想要的.

```ts
class TimingMiddleware extends OhNetMiddleware {
  readonly name = "timing"

  constructor(private readonly onTiming: (url: string, ms: number) => void) {
    super()
  }

  readonly enter = async (_adapter: OhNetAdapter, context: OhNetContext): Promise<void> => {
    context.meta.startedAt = performance.now()
  }

  readonly leave = async (_adapter: OhNetAdapter, context: OhNetContext): Promise<void> => {
    const startedAt = context.meta.startedAt as number | undefined
    if (startedAt === undefined)
      return
    this.onTiming(context.request.url, performance.now() - startedAt)
  }
}
```

## 退避重试

`controls.retry()` 会重跑整条管线, 上限为 `middlewareRetries` (默认 `1`). `controls.retryCount` 在首次尝试时为 `0`, 所以它同时充当退避指数.

```ts
import type { OhNetMiddlewareLeaveControls } from "@xtwis/ohnet"

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

class BackoffRetryMiddleware extends OhNetMiddleware {
  readonly name = "backoff-retry"

  constructor(private readonly baseDelay = 300) {
    super()
  }

  readonly leave = async (
    _adapter: OhNetAdapter,
    context: OhNetContext,
    controls: OhNetMiddlewareLeaveControls,
  ): Promise<void> => {
    const code = (context.error as { code?: string } | null)?.code
    if (code !== "OHNET_NETWORK" && code !== "OHNET_TIMEOUT")
      return

    const attempt = controls.retryCount
    await sleep(this.baseDelay * 2 ** attempt)
    controls.retry()
  }
}

const client = new OhNetBuilder({
  url: "https://api.example.com",
  middlewareRetries: 3,
}).with(new BackoffRetryMiddleware())
```

一旦预算用尽, `controls.retry()` 不再起作用, 请求以 `OHNET_RETRY_EXHAUSTED` 失败.

## 响应缓存

把重复的 `GET` 从内存返回. `enter` 可以写入 `context.response` 并调用 `skip()`, 从而跳过适配器; 当 response 已设置时, 管线报告的是 `SUCCESS` 而不是 `SKIPPED`.

```ts
import type { OhNetMiddlewareEnterControls, OhNetResponse } from "@xtwis/ohnet"

interface CacheEntry {
  response: OhNetResponse
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

class CacheMiddleware extends OhNetMiddleware {
  readonly name = "cache"

  constructor(private readonly ttl: number) {
    super()
  }

  readonly enter = async (
    _adapter: OhNetAdapter,
    context: OhNetContext,
    controls: OhNetMiddlewareEnterControls,
  ): Promise<void> => {
    if (context.request.method !== "GET")
      return
    const entry = cache.get(context.request.url)
    if (!entry || entry.expiresAt <= Date.now())
      return
    context.response = entry.response
    controls.skip()
  }

  readonly leave = async (_adapter: OhNetAdapter, context: OhNetContext): Promise<void> => {
    if (context.request.method !== "GET" || context.error || !context.response)
      return
    const ok = context.response.status >= 200 && context.response.status < 300
    if (!ok)
      return
    cache.set(context.request.url, {
      response: context.response,
      expiresAt: Date.now() + this.ttl,
    })
  }
}
```

把 `unpack` 注册在 `cache` **之前**, 缓存条目在返回时才会被解包: `cache.leave` 先运行 (逆序) 并存入原始信封, 随后 `unpack.leave` 把它拆开. 适配器只在未命中时运行.

注意缓存的 `OhNetResponse` 会跨请求共享. 如果后续中间件要修改它, 先用 `createResponse` 和新的 `OhNetHeader` 克隆一份.

## 飞行中合并

去重时间上重叠的相同请求: 第一个真正执行, 其余等待它的结果并跳过适配器.

```ts
const inflight = new Map<string, Promise<OhNetResponse | null>>()

interface DedupeEntry {
  key: string
  resolve: (value: OhNetResponse | null) => void
}

class DedupeMiddleware extends OhNetMiddleware {
  readonly name = "dedupe"

  readonly enter = async (
    _adapter: OhNetAdapter,
    context: OhNetContext,
    controls: OhNetMiddlewareEnterControls,
  ): Promise<void> => {
    const key = `${context.request.method} ${context.request.url}`
    const pending = inflight.get(key)
    if (pending) {
      const shared = await pending
      if (shared) {
        context.response = shared
        controls.skip()
        return
      }
    }

    const promise = new Promise<OhNetResponse | null>((resolve) => {
      context.meta.dedupe = { key, resolve } satisfies DedupeEntry
    })
    inflight.set(key, promise)
  }

  readonly leave = async (_adapter: OhNetAdapter, context: OhNetContext): Promise<void> => {
    const entry = context.meta.dedupe as DedupeEntry | undefined
    if (!entry)
      return
    entry.resolve(context.response)
    inflight.delete(entry.key)
  }
}
```

如果领跑者失败, 它会把共享 promise resolve 为 `null`; 跟随者看到 `null` 后走正常分支, 各自发起请求, 而不是继承这次失败.

## 信封解包

成功时把 `{ code, data, message }` 压平成 `data`, 把失败留给下游的错误映射器.

```ts
function isEnvelop(value: unknown): value is { code: number, data: unknown, message: string } {
  return typeof value === "object" && value !== null
    && "code" in value && "data" in value && "message" in value
}

class UnpackMiddleware extends OhNetMiddleware {
  readonly name = "unpack"

  readonly leave = async (_adapter: OhNetAdapter, context: OhNetContext): Promise<void> => {
    if (!context.response)
      return
    const body = context.response.data
    if (isEnvelop(body) && body.code === 0)
      context.response.data = body.data
  }
}
```

## Token 注入

从任意来源 (内存, storage, store) 读取 token, 在进入时附上.

```ts
class TokenMiddleware extends OhNetMiddleware {
  readonly name = "token"

  constructor(private readonly getToken: () => string | undefined) {
    super()
  }

  readonly enter = async (_adapter: OhNetAdapter, context: OhNetContext): Promise<void> => {
    const token = this.getToken()
    if (token)
      context.request.headers.set("Authorization", `Bearer ${token}`)
  }
}
```

要与 401 刷新配合, 再配一个调用 `controls.retry()` 的 `leave` 钩子. 完整流程见 [构建业务 API 客户端](./business-client.md).

## 组合

按你希望的 `enter` 顺序注册, 然后反向理解 `leave`:

```ts
const client = new OhNetBuilder({ url: BASE })
  .with(new RequestIdMiddleware()) // enter 最先, leave 最后
  .with(new TokenMiddleware(getToken))
  .with(new BackoffRetryMiddleware())
  .on(OHNET_EVENT.ERROR, (_, ctx) => log(ctx.error))
```

调用 `terminate()` 的中间件会同时抑制后续所有 `enter` **和** `leave`; `skip()` 只停止 `enter` 链, 因此已经进入的中间件仍会执行 `leave`. 完整的控制流规则见 [管线](../guide/pipeline.md).

## 下一步

- [构建业务 API 客户端](./business-client.md): 把这些部件组装成 SDK.
- [测试与模拟适配器](./testing.md): 在没有网络的情况下验证每个食谱.
- [管线](../guide/pipeline.md): 控制流与生命周期事件.
