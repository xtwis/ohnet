---
title: HTTP 请求
---

# {{ $frontmatter.title }}

本页覆盖请求表面: 动词, body 解码, 查询字符串序列化, 以及每请求覆盖. 以下所有内容都是同一个底层 `request<T>(config)` 入口的薄薄一层; 理解了入口, 就能看清每个便捷方法何时起作用.

## 动词

七个便捷方法 (`get`, `post`, `put`, `delete`, `patch`, `head`, `options`) 把 `request<T>(config)` 包装成一个固定的 `method` 和略微裁剪的参数形态:

```ts
// path, params, data 均可选
client.get<T>(path, params, data) // GET, params 通常用在这里
client.post<T>(path, data) // POST, body 用 data
client.put<T>(path, data)
client.delete<T>(path, data)
client.patch<T>(path, data)
client.head<T>(path, data)
client.options<T>(path, data)
```

第一个参数永远是被拼接到当前 Builder URL 的**路径片段** (不会自动加分隔符, 你自己加前导 `/`). `data` 是请求体, 原样转发给适配器.

便捷方法的存在是为了对称和可读. 真正的能力在 `request<T>(config)`:

```ts
await client.request<MyResponse>({
  method: "POST",
  url: "/items",
  data: { foo: "bar" },
  responseType: "json",
})
```

当你需要**每请求覆盖** (不同的 `responseType`, 定制 `signal`, 更紧的 `timeout`, 一次性 `headers`) 时, 用 `request()`. 其他场景, 动词助手更清晰.

## Body 解码 (`responseType`)

`responseType` 决定适配器为 `response.data` 产出什么形态. 默认是 `"auto"`: 当 `content-type: application/json` 时取 `"json"`, 否则取 `"text"`. 这覆盖了 90% 场景 (类型化 JSON API), 无需配置.

值得知道的三个覆盖:

- **`"json"`**: 即使服务器省略 content-type, 也强制 `Response.json()`.
- **`"stream"`**: 把 `response.body` 作为 `ReadableStream` 返回. 大或无界的 body 必备.
- **`"raw"`**: 返回适配器的原生传输对象 (例如原生 `Response`). 当自定义适配器暴露框架未建模的额外能力时很有用.

完整的七种矩阵 (包括 `arraybuffer`, `blob`, `text`) 见 [API 参考](../reference/api.md).

### 每请求覆盖

`responseType` 是每请求的, 所以一个默认 `auto` 的客户端也能发出流式下载:

```ts
const stream = await client
  .append("/files/large")
  .request<ReadableStream>({ responseType: "stream" })
```

## 查询字符串 (`params`)

`params` 作为查询字符串拼接到 URL. 接受三种形态:

```ts
client.get("/search", "raw=1") // string
client.get("/search", { page: 2, tag: ["a", "b"] }) // Record
client.get("/search", new URLSearchParams([["q", "x"]])) // Iterable
```

### 选哪种

- **`Record`**: 默认选择. 数组展开为重复 key (`?tag=a&tag=b`); `null` 和 `undefined` 被跳过. 覆盖约 90% 场景.
- **`string`**: 当你有一个**已经编码好**的查询字符串想原样传入 (罕见). 如果有, 前导符去除.
- **`URLSearchParams`**: 当你需要**保留插入顺序** (例如后端签名按顺序计算), 或控制 Record 路径无法覆盖的编码边界.

```ts
// Record: null 和 undefined 干净跳过
client.get("/items", { page: 2, archived: undefined }) // produces: ?page=2

// URLSearchParams: 当顺序重要时
const qs = new URLSearchParams()
qs.append("z", "1")
qs.append("a", "2")
client.get("/items", qs) // produces: ?z=1&a=2
```

## 每请求覆盖

覆盖 Builder 默认时, 三个字段最常用:

| Field               | Purpose                                            |
| ------------------- | -------------------------------------------------- |
| `timeout`           | 每请求超时 (毫秒), 优先级高于 Builder 的 `timeout` |
| `signal`            | 外部 `AbortSignal`; 完成前中断会产生 `OHNET_ABORT` |
| `middlewareRetries` | 每请求的重试上限, 覆盖 Builder 默认                |

```ts
const controller = new AbortController()

await client.get("/slow", undefined, undefined, {
  timeout: 5_000,
  signal: controller.signal,
  middlewareRetries: 3,
})
```

`signal` 与 `timeout` 协同: 超时前 `signal` 中断会产生 `OHNET_ABORT`; 没有显式中断的超时会产生 `OHNET_TIMEOUT`. 两条路径在 catch 处可区分, 见 [错误处理](./errors.md).

`middlewareRetries` 仅影响**中间件驱动的**重试 (`controls.retry()`). 适配器层重试由 `autoRetries` 单独控制, 取决于适配器实现.

## 下一步

- [构建业务 API 客户端](../example/building-business-client.md): 把所有部件组合成真正的 SDK.
- [API 参考](../reference/api.md): 完整签名与错误代码.
