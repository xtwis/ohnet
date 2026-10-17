---
title: 客户端
order: 1
---

# {{ $frontmatter.title }}

`OhNetClient` 是入口. 每次配置调用都返回新实例, 因此客户端可以安全共享, 保留和派生. 状态严格不可变: 中间件, 事件, 请求与适配器都以 `readonly` 字段持有, 每个变更方法(`with` / `clean` / `on` / `off` / `add` / `fork` / `append`)都返回新客户端, 不修改原实例.

## OhNetClient

```ts
class OhNetClient {
  static create(config?: OhNetConfig): OhNetClient

  fork(options?: {
    adapter?: OhNetAdapter
    context?: OhNetContext
    middlewares?: readonly OhNetMiddleware[]
    events?: ReadonlyMap<OhNetEventName, readonly OhNetEventHandler[]>
  }): OhNetClient
  add(config: OhNetConfig): OhNetClient
  with(middleware: OhNetMiddleware): OhNetClient
  clean(name: string): OhNetClient
  on(event: OhNetEventName, callback: OhNetEventHandler): OhNetClient
  off(event: OhNetEventName, target: OhNetEventHandler): OhNetClient
  append(path: string): OhNetClient

  middlewares(): OhNetMiddlewareQuery
  events(): OhNetEventQuery

  request<T>(config?: OhNetConfig): Promise<T>
  get<T>(path?: string, params?: OhNetParams, data?: unknown): Promise<T>
  post<T>(path?: string, data?: unknown): Promise<T>
  put<T>(path?: string, data?: unknown): Promise<T>
  delete<T>(path?: string, data?: unknown): Promise<T>
  patch<T>(path?: string, data?: unknown): Promise<T>
  head<T>(path?: string, data?: unknown): Promise<T>
  options<T>(path?: string, data?: unknown): Promise<T>
}
```

四参数构造器是私有的, 仅供 [`create`](#createconfig) 与 [`fork`](#forkoptions) 内部初始化新实例时使用. 不属于公开 API.

### create(config?)

构造客户端的公开入口. 从 `config` 计算初始适配器与请求, 并以空的中间件 / 事件注册表启动.

| 参数     | 类型          | 描述                                                                            |
| -------- | ------------- | ------------------------------------------------------------------------------- |
| `config` | `OhNetConfig` | 初始配置. `url` 为基础 URL; `adapter` 缺省为内置的 `fetchAdapter`. 缺省为 `{}`. |

适配器按引用存储, 构造时不调用, 因此在无 `globalThis.fetch` 的运行时也能安全 import 包.

### fork(options?)

返回由当前客户端派生的新客户端, 4 个字段可选覆盖. 未传字段沿用原值; `middlewares` 与 `events` 默认按值复制. 是私有四参数构造器的类型化封装.

| 参数      | 类型          | 描述                                                                 |
| --------- | ------------- | -------------------------------------------------------------------- |
| `options` | object (可选) | `adapter`, `context`, `middlewares`, `events` 的可选覆盖. 缺省 `{}`. |

| 字段           | 类型                                                        | 描述                                    |
| -------------- | ----------------------------------------------------------- | --------------------------------------- |
| `adapter?`     | `OhNetAdapter`                                              | 替换传输层. 缺省沿用原适配器.           |
| `context?`     | `OhNetContext`                                              | 直接替换请求上下文. 缺省沿用原上下文.   |
| `middlewares?` | `readonly OhNetMiddleware[]`                                | 替换中间件注册表. 缺省为原注册表的拷贝. |
| `events?`      | `ReadonlyMap<OhNetEventName, readonly OhNetEventHandler[]>` | 替换事件注册表. 缺省为原注册表的拷贝.   |

### add(config)

通过 `resolveRequest` 把 `config` 合并进当前请求, 然后经 [`fork({ context })`](#forkoptions) 派生新客户端. 仅请求相关字段 (`url`, `method`, `headers`, `params`, `data` 等) 生效; 替换中间件 / 事件 / 适配器请直接使用 `fork`.

| 参数     | 类型          | 描述                    |
| -------- | ------------- | ----------------------- |
| `config` | `OhNetConfig` | 合并进当前请求的覆盖项. |

### with(middleware)

按 `name` 注册或替换中间件, 返回新客户端. 注册 `name` 已存在的中间件会替换原槽位实现, 保持顺序. `name` 为空或仅空白时抛出 `OHNET_MIDDLEWARE_NAME`.

### clean(name)

移除所有 `name` 匹配的中间件. 无匹配时为 no-op.

### on(event, callback)

注册事件处理器. 同一事件的多个处理器按注册顺序触发; 处理器异常被吞掉. 见 [Middleware and Events](./middleware.md#ohnet_event).

### off(event, target)

按引用移除所有与 `target` 匹配的处理器.

### append(path)

返回一个新客户端, 其 URL 为当前 URL 拼接 `path`. 不插入分隔符, 前导 `/` 需自己加上. 已有的查询字符串会保留.

### middlewares()

返回对当前中间件注册表的只读查询. 每次调用返回注册表的快照; 对查询的修改不会回传到客户端. 查询方法见 [Middleware Query](#middleware-query).

### events()

返回对当前事件注册表的只读查询. 每次调用返回快照; 对查询的修改不会回传到客户端. 查询方法见 [Event Query](#event-query).

### Middleware Query

由 [`middlewares()`](#middlewares) 返回. 当前中间件注册表的快照, 提供三个只读方法.

| 方法        | 类型                                             | 描述                                              |
| ----------- | ------------------------------------------------ | ------------------------------------------------- |
| `get(name)` | `(name: string) => OhNetMiddleware \| undefined` | 首个匹配 `name` 的中间件; 无匹配返回 `undefined`. |
| `has(name)` | `(name: string) => boolean`                      | 是否注册了指定 `name` 的中间件.                   |
| `list()`    | `() => readonly OhNetMiddleware[]`               | 已注册中间件的快照, 按执行顺序.                   |

### Event Query

由 [`events()`](#events) 返回. 当前事件注册表的快照, 提供三个只读方法.

| 方法           | 类型                                                                   | 描述                                                              |
| -------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `get(event)`   | `(event: OhNetEventName) => readonly OhNetEventHandler[] \| undefined` | 注册到该事件的处理器; 无注册返回 `undefined`. 返回的数组是新副本. |
| `has(event)`   | `(event: OhNetEventName) => boolean`                                   | 该事件是否有任一处理器注册.                                       |
| `list(event?)` | `(event?: OhNetEventName) => readonly OhNetEventHandler[]`             | 指定事件的处理器; 不传 `event` 时返回所有事件的全部处理器.        |

### request<T>(config?)

通过 `add` 把 `config` 合并进当前请求, 运行管线, 并以 `response.data` 作为 `T` resolve.

| 参数     | 类型          | 描述                       |
| -------- | ------------- | -------------------------- |
| `config` | `OhNetConfig` | 可选每请求覆盖. 缺省 `{}`. |

**返回:** `Promise<T>`.

**抛出:** 任意 `OhNetError`. 常见 code:

- `OHNET_NO_RESPONSE` — 适配器返回且无中间件写入 response 时.
- `OHNET_SKIPPED` — 中间件 skip 且未提供 response 时.
- `OHNET_RETRY_EXHAUSTED` — 中间件重试超过 `middlewareRetries` 时.
- 任何适配器错误 (`OHNET_NETWORK` / `OHNET_TIMEOUT` / `OHNET_ABORT` / `OHNET_NO_FETCH`).

### HTTP 动词

每个动词把 `path` 拼到当前 URL, 然后以固定 method 调 `request<T>`. `path`, `params`, `data` 均可选. `get` 的 `params` 是查询源; 其他动词的第二个参数是请求体.

| 方法         | 签名                                                                  |
| ------------ | --------------------------------------------------------------------- |
| `get<T>`     | `(path?: string, params?: OhNetParams, data?: unknown) => Promise<T>` |
| `post<T>`    | `(path?: string, data?: unknown) => Promise<T>`                       |
| `put<T>`     | `(path?: string, data?: unknown) => Promise<T>`                       |
| `delete<T>`  | `(path?: string, data?: unknown) => Promise<T>`                       |
| `patch<T>`   | `(path?: string, data?: unknown) => Promise<T>`                       |
| `head<T>`    | `(path?: string, data?: unknown) => Promise<T>`                       |
| `options<T>` | `(path?: string, data?: unknown) => Promise<T>`                       |

`request<T>()` 以 `response.data` resolve; 泛型 `T` 描述该值.

## OhNetConfig

[`create`](#createconfig), [`add`](#addconfig) 和 [`request`](#request-t-config) 接受的顶层配置. 在 [`OhNetRequestConfig`](#ohnetrequestconfig) 基础上加一个可选传输层.

| 属性      | 类型           | 描述                                   |
| --------- | -------------- | -------------------------------------- |
| `adapter` | `OhNetAdapter` | 传输实现. 缺省为内置的 `fetchAdapter`. |

## OhNetRequestConfig

部分请求配置. 每个字段都可选; 未定义的字段保持当前值不变.

| 属性                | 类型                | 描述                                                |
| ------------------- | ------------------- | --------------------------------------------------- |
| `url`               | `string`            | 目标 URL. 替换客户端当前的 URL.                     |
| `method`            | `OhNetMethod`       | HTTP 方法. 替换当前方法.                            |
| `headers`           | `OhNetHeaderLike`   | 在现有 header 集合上叠加 (右侧同名优先).            |
| `params`            | `OhNetParams`       | 查询源. 替换之前配置的 `params`.                    |
| `data`              | `unknown`           | 请求体. 原样转发给适配器.                           |
| `signal`            | `OhNetSignal`       | 外部 abort signal. 转发给适配器.                    |
| `timeout`           | `number`            | 超时 (毫秒). `undefined` 表示关闭超时.              |
| `middlewareRetries` | `number`            | 每请求最大中间件层重试次数. 缺省 `1`.               |
| `autoRetries`       | `boolean \| number` | 适配器层的自动重试信号. 原样转发, 语义由适配器决定. |
| `responseType`      | `OhNetResponseType` | body 解码策略.                                      |

## 下一步

- [中间件与事件](./middleware.md): 钩子, 控件, 事件.
- [适配器与上下文](./transport.md): 请求与响应类型.
- [错误](./errors.md): 错误类与 code.
