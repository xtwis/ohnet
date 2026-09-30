---
title: 错误
order: 4
---

# {{ $frontmatter.title }}

库抛出的每个错误都是 `OhNetError`. 只导出两个类: 基类 `OhNetError` 和 `OhNetAdapterError`. 内部错误与未知错误通过 `type` 和 `code` 常量识别.

## OhNetError

```ts
class OhNetError extends Error {
  type: string
  code: string
  message: string
  data?: unknown
  error?: unknown

  constructor(type: string, code: string, message: string, data?: unknown, error?: unknown)
}
```

| 属性      | 类型      | 描述                                        |
| --------- | --------- | ------------------------------------------- |
| `type`    | `string`  | 粗粒度分类. 取某个 `OHNET_*_ERROR_TYPE` 值. |
| `code`    | `string`  | 具体失败模式. 按它分支.                     |
| `message` | `string`  | 无前缀的可读描述.                           |
| `data`    | `unknown` | 可选结构化载荷. 库从不检查它.               |
| `error`   | `unknown` | 可选的底层原因, 保留用于日志.               |

为便于堆栈阅读, `Error.message` 会被设为 `[${code}] ${message}`; 原始文本在 `this.message`.

## OhNetAdapterError

```ts
class OhNetAdapterError extends OhNetError {
  constructor(code: string, message: string, data?: unknown, error?: unknown)
}
```

`type` 为 `OHNET_ADAPTER` 的 `OhNetError`. 适配器抛出它, 以便 catch 处用 `instanceof` 区分传输失败.

## OHNET_ERROR_TYPE / OHNET_ERROR_CODE / OHNET_ERROR_MESSAGE

框架内部的结局.

```ts
const OHNET_ERROR_TYPE = "OHNET_INTERNAL"
```

| code 常量         | 值                      | 含义                                             |
| ----------------- | ----------------------- | ------------------------------------------------ |
| `MIDDLEWARE_NAME` | `OHNET_MIDDLEWARE_NAME` | 注册的中间件 name 为空或只有空白字符.            |
| `NO_RESPONSE`     | `OHNET_NO_RESPONSE`     | 管线正常结束但没有任何响应产生.                  |
| `RETRY_EXHAUSTED` | `OHNET_RETRY_EXHAUSTED` | `controls.retry()` 调用超过 `middlewareRetries`. |
| `SKIPPED`         | `OHNET_SKIPPED`         | 中间件跳过或终止, 且没有写入 response.           |

`OHNET_ERROR_MESSAGE` 把每个 code 映射到默认 message (`"ohnet: ..."`). message 只是建议; 按 `code` 分支.

## OHNET_ADAPTER_ERROR_TYPE / OHNET_ADAPTER_ERROR_CODE / OHNET_ADAPTER_ERROR_MESSAGE

传输层失败.

```ts
const OHNET_ADAPTER_ERROR_TYPE = "OHNET_ADAPTER"
```

| code 常量  | 值               | 含义                                                    |
| ---------- | ---------------- | ------------------------------------------------------- |
| `ABORT`    | `OHNET_ABORT`    | 用户 signal 在完成前中止.                               |
| `NETWORK`  | `OHNET_NETWORK`  | 传输层拒绝了请求 (DNS, 连接重置, TLS 等).               |
| `NO_FETCH` | `OHNET_NO_FETCH` | 内置适配器在 `globalThis.fetch` 不是函数的运行时中执行. |
| `TIMEOUT`  | `OHNET_TIMEOUT`  | 请求超过 `request.timeout`.                             |

`OHNET_ADAPTER_ERROR_MESSAGE` 把每个 code 映射到默认 message.

## OHNET_UNKNOWN_ERROR_TYPE / OHNET_UNKNOWN_ERROR_CODE / OHNET_UNKNOWN_ERROR_MESSAGE

调度器会把中间件或适配器抛出的任何非 `OhNetError` 重新包装.

```ts
const OHNET_UNKNOWN_ERROR_TYPE = "OHNET_UNKNOWN"
const OHNET_UNKNOWN_ERROR_CODE = "OHNET_UNKNOWN"
const OHNET_UNKNOWN_ERROR_MESSAGE = "ohnet: unknown error"
```

包装后的错误把原值保留在 `error.error`, 且 `type` 与 `code` 都是 `OHNET_UNKNOWN`, 因此原错误的结构化 `code` 丢失. 抛 `OhNetError` 才能让 catch 处保持可分支.

## 识别矩阵

| `type`           | 产生方                             | 识别方式                                  |
| ---------------- | ---------------------------------- | ----------------------------------------- |
| `OHNET_INTERNAL` | 框架内部                           | `error.type === OHNET_ERROR_TYPE`         |
| `OHNET_ADAPTER`  | 适配器, 包括内置的 `fetchAdapter`  | `error instanceof OhNetAdapterError`      |
| `OHNET_UNKNOWN`  | 调度器, 包装非 `OhNetError` 的抛出 | `error.type === OHNET_UNKNOWN_ERROR_TYPE` |

## 下一步

- [Builder](./builder.md): `request<T>()` 抛出这些错误.
- [中间件与事件](./middleware.md): 产生内部 code 的控制流.
- [适配器与上下文](./transport.md): 适配器抛出 `OhNetAdapterError`.
