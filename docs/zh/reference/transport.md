---
title: 适配器与上下文
order: 3
---

# {{ $frontmatter.title }}

适配器是传输边界. 上下文是单个请求中被贯穿传递的可变状态.

## OhNetAdapter

```ts
type OhNetAdapter = (context: OhNetContext) => Promise<OhNetResponse>
```

接收完全解析后的上下文并返回规范化响应. 适配器承担四项职责: 发起请求, 以 `OhNetResponse` resolve, 遵守 `signal` 与 `timeout`, 并以 `OhNetAdapterError` 暴露失败.

适配器抛出的错误会到达 `context.error`: `OhNetError` 原样保留, 其他值会被重新包装为 type 和 code 均为 `OHNET_UNKNOWN` 的错误.

## OhNetContext

```ts
interface OhNetContext {
  request: OhNetRequest
  response: OhNetResponse | null
  error: OhNetError | null
  meta: Record<string | symbol, unknown>
}
```

| 属性       | 类型                                | 描述                                                     |
| ---------- | ----------------------------------- | -------------------------------------------------------- |
| `request`  | `OhNetRequest`                      | 解析后的请求. 适配器运行前可变.                          |
| `response` | `OhNetResponse \| null`             | 适配器结果. 适配器运行前以及跳过或错误路径之后为 `null`. |
| `error`    | `OhNetError \| null`                | 适配器或中间件错误. 判定结果时先于 `response` 检查.      |
| `meta`     | `Record<string \| symbol, unknown>` | 开放的每请求状态袋, 用于中间件之间通信. 允许 symbol 键.  |

## OhNetRequest

```ts
interface OhNetRequest {
  url: string
  method: OhNetMethod
  headers: OhNetHeader
  params?: OhNetParams
  data?: unknown
  signal?: OhNetSignal
  timeout?: number
  middlewareRetries?: number
  autoRetries?: boolean | number
  responseType: OhNetResponseType
}
```

| 属性                | 类型                | 描述                                    |
| ------------------- | ------------------- | --------------------------------------- |
| `url`               | `string`            | 目标 URL. 可能已包含查询字符串.         |
| `method`            | `OhNetMethod`       | HTTP method.                            |
| `headers`           | `OhNetHeader`       | 出站 header. 始终是实例, 从不为 `null`. |
| `params`            | `OhNetParams`       | 查询来源. `undefined` 表示不追加查询.   |
| `data`              | `unknown`           | 请求体. 由适配器决定如何序列化.         |
| `signal`            | `OhNetSignal`       | 外部取消信号.                           |
| `timeout`           | `number`            | 超时毫秒数.                             |
| `middlewareRetries` | `number`            | 中间件重试上限. 默认 `1`.               |
| `autoRetries`       | `boolean \| number` | 适配器级自动重试信号. 语义由适配器定义. |
| `responseType`      | `OhNetResponseType` | body 解码策略.                          |

## OhNetResponse

```ts
interface OhNetResponse<T = unknown> {
  status: number
  statusText: string
  ok: boolean
  headers: OhNetHeader
  url: string
  redirected: boolean
  type: OhNetResponseKind
  data: T
  body?: unknown
}
```

| 属性         | 类型                | 描述                                                   |
| ------------ | ------------------- | ------------------------------------------------------ |
| `status`     | `number`            | HTTP 状态码.                                           |
| `statusText` | `string`            | HTTP 状态文本. 传输层未提供时为空字符串.               |
| `ok`         | `boolean`           | `status` 在 200-299 范围内时为 true, 除非适配器覆盖.   |
| `headers`    | `OhNetHeader`       | 响应 header.                                           |
| `url`        | `string`            | 重定向后的最终 URL.                                    |
| `redirected` | `boolean`           | 响应至少经过一次重定向时为 true.                       |
| `type`       | `OhNetResponseKind` | 响应分类, 镜像 Fetch 规范.                             |
| `data`       | `T`                 | 解码后的 body. 类型取决于 `T` 与请求的 `responseType`. |
| `body`       | `unknown`           | 适配器选择暴露时携带的原始传输对象.                    |

## createResponse

```ts
function createResponse<T>(input: OhNetResponseLike<T>): OhNetResponse<T>
```

把宽松的适配器响应规范化为 `OhNetResponse`. 补全默认值: `statusText` 变为 `""`, `ok` 依据 `status` 是否在 200-299 范围, `redirected` 变为 `false`, `type` 变为 `"default"`. header 集合会被重建, 因此结果不与输入共享存储.

## OhNetResponseLike

```ts
interface OhNetResponseLike<T = unknown> {
  status: number
  headers: OhNetHeaderLike
  url: string
  statusText?: string
  ok?: boolean
  redirected?: boolean
  type?: OhNetResponseKind
  data?: T
  body?: unknown
}
```

适配器可以交给 `createResponse` 的宽松形态. `status`, `headers`, `url` 必填; 其余在缺失时会被合成.

## OhNetMethod

```ts
type OhNetMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS"
```

## OhNetParams

```ts
type OhNetParams
  = | string
    | Record<string, unknown>
    | Iterable<readonly [string, string]>
```

| 形态                         | 行为                                                                |
| ---------------------------- | ------------------------------------------------------------------- |
| `string`                     | 原样使用, 会剥掉前导 `?`.                                           |
| `Record<string, unknown>`    | 按插入顺序 URL 编码; 数组变成重复 key; `null` / `undefined` 被跳过. |
| `Iterable<[string, string]>` | 原始 pair 迭代, 保留顺序与重复项.                                   |

## OhNetResponseType

```ts
type OhNetResponseType = "auto" | "json" | "text" | "arraybuffer" | "blob" | "stream" | "raw"
```

| 取值            | body 变为                                                    |
| --------------- | ------------------------------------------------------------ |
| `"auto"`        | `content-type` 为 `application/json` 时取 JSON, 否则取 text. |
| `"json"`        | `Response.json()`; 解析失败时为 `null`.                      |
| `"text"`        | `Response.text()`.                                           |
| `"arraybuffer"` | `Response.arrayBuffer()`.                                    |
| `"blob"`        | `Response.blob()`.                                           |
| `"stream"`      | `Response.body`, 一个 `ReadableStream`.                      |
| `"raw"`         | 原生 `Response` 对象.                                        |

## OhNetResponseKind

```ts
type OhNetResponseKind = "basic" | "cors" | "default" | "error" | "opaque" | "opaqueredirect"
```

镜像 Fetch 规范的 `Response.type`.

## buildQueryString

```ts
function buildQueryString(params: OhNetParams): string
```

把任意 `OhNetParams` 形态序列化为不带前导 `?` 的编码查询字符串. `string` 输入会先剥掉一个前导 `?` 后返回. iterable 按 `[name, value]` pair 消费; record 按插入顺序迭代. 数组展开为重复 key; `null` 与 `undefined` 值被跳过.

```ts
buildQueryString({ page: 2, tag: ["a", "b"] }) // "page=2&tag=a&tag=b"
buildQueryString("?raw=1") // "raw=1"
```

## 下一步

- [Builder](./builder.md): 请求如何被组装.
- [中间件与事件](./middleware.md): 适配器周围运行什么.
- [Headers](./header.md): 请求与响应使用的 `OhNetHeader` 集合.
