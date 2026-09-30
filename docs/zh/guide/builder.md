---
title: Builder
order: 3
---

# {{ $frontmatter.title }}

`OhNetBuilder` 是 ohnet 的唯一入口. 每个配置方法都是流畅且不可变的: 每次调用都返回新实例, 而非修改原实例. 这让 Builder 可以安全共享, 派生, 跨请求复用.

## 创建 Builder

```ts
import { OhNetBuilder } from "@xtwis/ohnet"

const client = new OhNetBuilder({
  url: "https://api.example.com",
  // 可选:
  // adapter: myAdapter,             // 默认: 内置 fetch 适配器
  // headers: { "x-app": "demo" },   // 初始 headers
  // timeout: 10_000,                // 默认每请求超时
  // middlewareRetries: 1,           // 重试上限
})
```

唯一必填字段是 `url`. 通过 `adapter` 替换传输层, 见 [Adapter](./adapter.md).

## 配置方法

每个方法都返回新的 `OhNetBuilder`:

| Method                | Returns        | Purpose                    |
| --------------------- | -------------- | -------------------------- |
| `fork(config?)`       | `OhNetBuilder` | 派生子 Builder, 可选覆盖   |
| `add(config)`         | `OhNetBuilder` | `fork` 的别名, 必传 config |
| `with(middleware)`    | `OhNetBuilder` | 按 `name` 注册或替换中间件 |
| `clean(name)`         | `OhNetBuilder` | 按 `name` 移除中间件       |
| `on(event, handler)`  | `OhNetBuilder` | 注册事件处理器             |
| `off(event, handler)` | `OhNetBuilder` | 按引用移除事件处理器       |
| `append(path)`        | `OhNetBuilder` | 将 `path` 拼接到当前 URL   |

### 派生子客户端

`fork()` 和 `add()` 生成的子 Builder 共享父 Builder 的中间件, 事件, 适配器, 然后应用你传入的覆盖. 关键是, 子 Builder 的 `meta` 会被重置为 `{}`, 中间件之间的状态不会跨请求泄漏:

```ts
const v1 = client.fork({ headers: { "x-version": "1" } })
const v2 = client.fork({ headers: { "x-version": "2" } })

await v1.get("/items") // x-version: 1
await v2.get("/items") // x-version: 2
await client.get("/items") // 无 x-version
```

用这个模式可以从共享基类生成每请求变体 (鉴权范围, 语言, 特性开关).

### URL 拼接

`append(path)` 把 `path` 拼接到当前 URL. **不会自动加分隔符**: 自己加上前导 `/`:

```ts
const api = new OhNetBuilder({ url: "https://api.example.com" })
const v1 = api.append("/v1")
const items = v1.append("/items") // produces: https://api.example.com/v1/items
```

`append` 不会剥除已有的查询字符串. 如果需要替换查询, 用 `fork` 传入新的 `url`.

### 中间件注册

`with()` 按 `name` 注册. 注册同名中间件会替换同一槽位. `clean(name)` 移除所有同名中间件:

```ts
const a = client.with(new TimingMiddleware())
const b = a.with(new OtherTimingMiddleware("timing")) // 替换 "timing"
const c = b.clean("timing") // 回到无 timing
```

通过 `builder.middleware.list()` 查看已注册列表.

## HTTP 动词

七个便捷方法, 都返回 `Promise<T>`, 其中 `T` 是 `response.data` 的期望类型:

```ts
// path, params, data 均可选
client.get<T>(path, params, data)
client.post<T>(path, data)
client.put<T>(path, data)
client.delete<T>(path, data)
client.patch<T>(path, data)
client.head<T>(path, data)
client.options<T>(path, data)
```

需要完整控制时, 用 `request<T>(config)`:

```ts
await client.append("/items").request<MyResponse>({
  method: "POST",
  headers: { "content-type": "application/json" },
  data: { foo: "bar" },
  params: { trace: 1 },
  signal: controller.signal,
  timeout: 5_000,
  middlewareRetries: 2,
  autoRetries: 3,
  responseType: "json",
})
```

`params`, `responseType`, 每请求覆盖的细节见 [HTTP Requests](./http.md).

## 组合使用

典型的链式调用自上而下: 基础 URL, 然后中间件, 然后事件, 然后动词:

```ts
import { OHNET_EVENT, OhNetBuilder } from "@xtwis/ohnet"

const client = new OhNetBuilder({ url: BASE })
  .with(new AuthMiddleware(/* getToken, refresh, onToken */))
  .with(new UnpackMiddleware())
  .with(new TimingMiddleware())
  .on(OHNET_EVENT.ERROR, (_, ctx) => log(ctx.error))

await client.post("/login", { user, pass })
```

因为每个方法都返回新的 Builder, 你可以保留原实例用于复用, 任何时候需要一次性变体时 `fork` 即可.

## 下一步

- [Pipeline](./pipeline.md): 中间件 enter/leave 钩子和生命周期事件.
- [Adapter](./adapter.md): 何时以及如何编写自定义适配器.
