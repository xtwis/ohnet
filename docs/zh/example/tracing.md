---
title: 链路追踪与指标
order: 4
---

# {{ $frontmatter.title }}

生命周期事件是 ohnet 的观察面. 它们在固定时刻触发, 携带活的 `context`, 且永不改变结果, 因此非常适合日志, 链路追踪和指标.

## 八个事件

| 事件       | 触发时机                                       |
| ---------- | ---------------------------------------------- |
| `START`    | 每请求一次, 在任何中间件之前                   |
| `RETRY`    | 重试尝试的开头 (首次尝试不触发)                |
| `REQUEST`  | 所有 `enter` 钩子之后, 即将调用适配器          |
| `RESPONSE` | 适配器 (或中间件) 写入 `context.response` 之后 |
| `SUCCESS`  | 终止: `response` 已设置, `error` 为 null       |
| `SKIP`     | 终止: 管线被短路                               |
| `ERROR`    | 终止: `context.error` 非空                     |
| `FINISH`   | 永远最后, 每条路径都会触发                     |

每次尝试的顺序是 `REQUEST`, 适配器, `RESPONSE`, leave 钩子, 然后是 `SUCCESS` / `SKIP` / `ERROR` 三者之一. `RETRY` 标记新一次尝试的开始, `FINISH` 为整个请求收尾.

## 订阅

用 `.on` 注册处理器; 每个事件可以有多个, 按注册顺序触发. 每个 Builder 方法都返回新实例, 所以要接收返回值.

```ts
import { OHNET_EVENT, OhNetBuilder } from "@xtwis/ohnet"

const client = new OhNetBuilder({ url: BASE })
  .on(OHNET_EVENT.START, (_, ctx) => console.log("start", ctx.request.url))
  .on(OHNET_EVENT.SUCCESS, (_, ctx) => console.log("ok", ctx.response?.status))
  .on(OHNET_EVENT.ERROR, (_, ctx) => console.error("fail", ctx.error?.code))
  .on(OHNET_EVENT.FINISH, () => console.log("done"))
```

处理器收到 `(adapter, context)`. 当管线在传输层运行之前就被短路时, adapter 参数为 `null`.

## 结构化日志

常见做法是: 一个中间件把身份和计时放进 `context.meta`, 再用事件处理器为每种结果打印一行.

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

`START` 在中间件运行之前触发, 所以那时 `meta` 还是空的. 在 `enter` 里记录身份与起点, 再到终止事件里读取它们.

## 指标

统计结果并收集耗时. `FINISH` 是唯一在每条路径上都会运行的点, 因此是直方图最干净的挂载处.

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

因为 `requests` 在 `REQUEST` 时递增, 在 `enter` 中被跳过的请求不会计入尝试. 如果想统计包括跳过在内的每一次调用, 改用 `START`.

## 重试

`RETRY` 每次重新尝试触发一次. 事件本身不暴露重试计数, 因此需要数字时自己维护一个, 或者在中间件内部读取 `controls.retryCount`.

```ts
let retries = 0

const client = new OhNetBuilder({ url: BASE, middlewareRetries: 3 })
  .on(OHNET_EVENT.RETRY, (_, ctx) => {
    retries += 1
    log("warn", "retrying", { url: ctx.request.url, attempt: retries })
  })
```

`SUCCESS` 和 `ERROR` 只对最终尝试触发. 之前的尝试会产生 `RESPONSE` 然后 `RETRY`, 如果需要每次都可见, 就把两者配对.

## 事件还是中间件?

两者有重叠, 按意图选择:

| 你的目标                     | 选择   |
| ---------------------------- | ------ |
| 观察, 打日志, 计数, 链路追踪 | 事件   |
| 修改 `request` 或 `response` | 中间件 |
| 短路, 重试, 调整顺序         | 中间件 |
| 把一个结果扇出给多个观察者   | 事件   |
| 读写跨中间件状态 (`meta`)    | 中间件 |

一条有用的准则: 如果它能改变调用方拿到的东西, 就属于中间件. 事件只用于旁路.

## 处理器安全与移除

处理器抛出的异常会被捕获并丢弃. 坏掉的观察者无法让请求失败, 因此绝不要从事件处理器上报关键错误; 应该在中间件里写入 `context.error`.

按引用移除处理器, 而不是按名字:

```ts
import type { OhNetEventHandler } from "@xtwis/ohnet"

const onError: OhNetEventHandler = (_, ctx) => log("error", "failed", { code: ctx.error?.code })

const withHandler = client.on(OHNET_EVENT.ERROR, onError)
const without = withHandler.off(OHNET_EVENT.ERROR, onError)
```

## 下一步

- [中间件食谱](./middleware.md): 同一条管线的修改侧.
- [测试与模拟适配器](./testing.md): 在测试中断言事件顺序.
- [管线](../guide/pipeline.md): 控制流与钩子顺序.
