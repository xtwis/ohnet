---
title: 中间件与事件
order: 2
---

# {{ $frontmatter.title }}

中间件钩子围绕适配器运行; 生命周期事件观察管线. 两者都注册在 builder 上.

## OhNetMiddleware

```ts
abstract class OhNetMiddleware {
  abstract readonly name: string
  enter?(adapter: OhNetAdapter, context: OhNetContext, controls: OhNetMiddlewareEnterControls): Promise<void>
  leave?(adapter: OhNetAdapter, context: OhNetContext, controls: OhNetMiddlewareLeaveControls): Promise<void>
}
```

| 成员    | 类型     | 描述                                               |
| ------- | -------- | -------------------------------------------------- |
| `name`  | `string` | 稳定标识, 用于 `with`, `clean` 与替换. 必须非空白. |
| `enter` | method   | 可选. 在适配器之前按注册顺序运行.                  |
| `leave` | method   | 可选. 在适配器之后按逆序运行.                      |

钩子内抛出的异常会被调度器捕获并写入 `context.error`. 直接抛 `OhNetError` 可保留 `type` 与 `code`; 其他值会被重新包装为 type 和 code 均为 `OHNET_UNKNOWN` 的错误.

## OhNetMiddlewareEnterControls

作为 `enter` 的第三个参数传入.

| 成员          | 类型         | 描述                                                                                                                                          |
| ------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `skip()`      | `() => void` | 适配器不执行. 后续 `enter` 钩子被跳过; `leave` 链仍会运行. 除非 `context.response` 已设置 (此时 `SUCCESS` 优先), 否则以 `OHNET_SKIPPED` 结束. |
| `terminate()` | `() => void` | 停止后续 `enter` 钩子, 并抑制整个 `leave` 链.                                                                                                 |
| `retry()`     | `() => void` | 重跑整条管线. 上限为 `request.middlewareRetries`.                                                                                             |
| `retryCount`  | `number`     | 该钩子运行前已发生的重试次数; 首次尝试为 `0`. 只读.                                                                                           |

调用 `skip`, `terminate` 或 `retry` 只是设置标记; 调度器在钩子返回后读取. 第一个调用生效.

## OhNetMiddlewareLeaveControls

作为 `leave` 的第三个参数传入. 返回路径上没有 `skip`.

| 成员          | 类型         | 描述                                                |
| ------------- | ------------ | --------------------------------------------------- |
| `terminate()` | `() => void` | 停止剩余的 `leave` 链.                              |
| `retry()`     | `() => void` | 重跑整条管线. 上限为 `request.middlewareRetries`.   |
| `retryCount`  | `number`     | 该钩子运行前已发生的重试次数; 首次尝试为 `0`. 只读. |

## OHNET_EVENT

把事件名映射到字符串值的常量对象.

```ts
const OHNET_EVENT = {
  START: "on_start",
  RETRY: "on_retry",
  REQUEST: "on_request",
  RESPONSE: "on_response",
  SUCCESS: "on_success",
  SKIP: "on_skip",
  ERROR: "on_error",
  FINISH: "on_finish",
} as const
```

| 事件       | 触发时机                                    |
| ---------- | ------------------------------------------- |
| `START`    | 每请求一次, 在任何中间件之前.               |
| `RETRY`    | 重试尝试的开头 (首次尝试不触发).            |
| `REQUEST`  | 所有 `enter` 钩子之后, 即将调用适配器.      |
| `RESPONSE` | 适配器或中间件写入 `context.response` 之后. |
| `SUCCESS`  | 终止: `response` 已设置, `error` 为 null.   |
| `SKIP`     | 终止: 管线被短路.                           |
| `ERROR`    | 终止: `context.error` 非空.                 |
| `FINISH`   | 永远最后, 每条路径都会触发.                 |

每次尝试的顺序是 `REQUEST`, 适配器, `RESPONSE`, leave 钩子, 然后是 `SUCCESS` / `SKIP` / `ERROR` 三者之一. `RETRY` 标记一次重新尝试; `FINISH` 为整个请求收尾.

## OhNetEventName

```ts
type OhNetEventName = (typeof OHNET_EVENT)[keyof typeof OHNET_EVENT]
```

八个事件名字符串的联合.

## OhNetEventHandler

```ts
type OhNetEventHandler = (adapter: OhNetAdapter, context: OhNetContext) => void
```

通过 `builder.on` 注册. 处理器按注册顺序运行. 当管线在传输层运行之前就被短路时, `adapter` 为 `null`. 处理器异常会被捕获并丢弃, 因此永不影响结果.

## 下一步

- [Builder](./builder.md): 注册中间件与处理器的地方.
- [适配器与上下文](./transport.md): 钩子收到的 `context`.
- [错误](./errors.md): 控制流产生的 code.
