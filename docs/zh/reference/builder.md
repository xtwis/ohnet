---
title: Builder
order: 1
---

# {{ $frontmatter.title }}

`OhNetBuilder` 是入口. 每个配置方法都返回新的 builder, 因此实例可以安全共享, 保留和派生.

## OhNetBuilder

```ts
class OhNetBuilder {
  constructor(config: OhNetConfig)

  fork(config?: OhNetConfig): OhNetBuilder
  add(config: OhNetConfig): OhNetBuilder
  with(middleware: OhNetMiddleware): OhNetBuilder
  clean(name: string): OhNetBuilder
  on(event: OhNetEventName, callback: OhNetEventHandler): OhNetBuilder
  off(event: OhNetEventName, target: OhNetEventHandler): OhNetBuilder
  append(path: string): OhNetBuilder

  get middleware(): OhNetMiddlewareRegistry
  get event(): OhNetEventRegistry

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

### constructor(config)

| 参数     | 类型          | 描述                                                               |
| -------- | ------------- | ------------------------------------------------------------------ |
| `config` | `OhNetConfig` | 初始配置. `url` 是基础 URL; `adapter` 默认为内置的 `fetchAdapter`. |

适配器按引用保存, 构造时不会调用, 因此在不带 `globalThis.fetch` 的运行时导入本包是安全的.

### fork(config?)

返回一个新的 builder, 它继承当前的 request, 中间件, 事件与适配器, 然后在其上合并 `config`. 子 builder 的 `meta` 袋会被重置为 `{}`, 因此中间件状态不会跨请求泄漏. `request` 与 `response` 会连同 header 一起复制; `error` 按引用共享.

| 参数     | 类型          | 描述                   |
| -------- | ------------- | ---------------------- |
| `config` | `OhNetConfig` | 可选覆盖. 默认为 `{}`. |

### add(config)

需要传入 config 的 [`fork`](#forkconfig) 别名. 行为完全一致.

### with(middleware)

按 `name` 注册或替换中间件, 返回新 builder. 注册 `name` 已存在的中间件会替换原槽位实现, 并保持顺序. 当 `name` 为空或只有空白字符时抛出 `OHNET_MIDDLEWARE_NAME`.

### clean(name)

移除所有具有该 `name` 的中间件. 没有匹配项时为 no-op.

### on(event, callback)

注册事件处理器. 同一事件的多个处理器按注册顺序触发; 处理器异常会被吞掉. 见 [中间件与事件](./middleware.md#ohnet_event).

### off(event, target)

按引用移除所有匹配 `target` 的处理器.

### append(path)

返回一个 URL 为当前 URL 拼接 `path` 之后的 builder. 不会插入分隔符, 前导 `/` 需自己加上. 已有的查询字符串会保留.

### middleware

返回中间件注册表. 该注册表类型不对外导出; 常用成员有 `list(): OhNetMiddleware[]`, `has(name: string): boolean`, `get(name: string): OhNetMiddleware | undefined`.

### event

返回事件注册表. 该注册表类型不对外导出; 常用成员有 `list(event?: OhNetEventName): readonly OhNetEventHandler[]`.

### request<T>(config?)

运行管线并以 `response.data` 作为 `T` resolve.

| 参数     | 类型          | 描述                           |
| -------- | ------------- | ------------------------------ |
| `config` | `OhNetConfig` | 可选的每请求覆盖. 默认为 `{}`. |

**返回:** `Promise<T>`.

**抛出:** 任意 `OhNetError`. 常见 code:

- `OHNET_NO_RESPONSE`: 适配器返回但没有写入 response, 且没有中间件写入.
- `OHNET_SKIPPED`: 中间件跳过且没有提供 response.
- `OHNET_RETRY_EXHAUSTED`: 中间件重试超过 `middlewareRetries`.
- 任意适配器错误 (`OHNET_NETWORK` / `OHNET_TIMEOUT` / `OHNET_ABORT` / `OHNET_NO_FETCH`).

### HTTP 动词

每个动词把 `path` 拼接到当前 URL, 并以固定 method 调用 `request<T>`. `path`, `params`, `data` 均可选. 对 `get` 而言 `params` 是查询来源; 对其他动词而言, 第二个参数是请求体.

| 方法         | 签名                                                                  |
| ------------ | --------------------------------------------------------------------- |
| `get<T>`     | `(path?: string, params?: OhNetParams, data?: unknown) => Promise<T>` |
| `post<T>`    | `(path?: string, data?: unknown) => Promise<T>`                       |
| `put<T>`     | `(path?: string, data?: unknown) => Promise<T>`                       |
| `delete<T>`  | `(path?: string, data?: unknown) => Promise<T>`                       |
| `patch<T>`   | `(path?: string, data?: unknown) => Promise<T>`                       |
| `head<T>`    | `(path?: string, data?: unknown) => Promise<T>`                       |
| `options<T>` | `(path?: string, data?: unknown) => Promise<T>`                       |

`request<T>()` resolve 的是 `response.data`; 泛型 `T` 描述的就是该值.

## OhNetConfig

构造函数以及 `fork` / `add` / `request` 接受的顶层配置. 在 [`OhNetRequestConfig`](#ohnetrequestconfig) 基础上增加可选的传输层.

| 属性      | 类型           | 描述                                   |
| --------- | -------------- | -------------------------------------- |
| `adapter` | `OhNetAdapter` | 传输实现. 默认为内置的 `fetchAdapter`. |

## OhNetRequestConfig

部分请求配置. 每个字段都可选; undefined 字段保持当前值不变.

| 属性                | 类型                | 描述                                              |
| ------------------- | ------------------- | ------------------------------------------------- |
| `url`               | `string`            | 目标 URL. 替换 builder 当前的 URL.                |
| `method`            | `OhNetMethod`       | HTTP method. 替换当前 method.                     |
| `headers`           | `OhNetHeaderLike`   | 合并到现有集合之上的 header (同名以右侧为准).     |
| `params`            | `OhNetParams`       | 查询来源. 替换此前配置的 `params`.                |
| `data`              | `unknown`           | 请求体. 原样转发给适配器.                         |
| `signal`            | `OhNetSignal`       | 外部取消信号. 转发给适配器.                       |
| `timeout`           | `number`            | 超时毫秒数. `undefined` 表示禁用.                 |
| `middlewareRetries` | `number`            | 每请求的中间件重试上限. 默认 `1`.                 |
| `autoRetries`       | `boolean \| number` | 适配器级自动重试信号. 原样转发, 语义由适配器定义. |
| `responseType`      | `OhNetResponseType` | body 解码策略.                                    |

## 下一步

- [中间件与事件](./middleware.md): 钩子, 控制与事件.
- [适配器与上下文](./transport.md): 请求与响应类型.
- [错误](./errors.md): 错误类与 code.
