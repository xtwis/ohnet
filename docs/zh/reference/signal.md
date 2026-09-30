---
title: 信号
order: 6
---

# {{ $frontmatter.title }}

ohnet 接受任何匹配一个小型鸭子类型接口的取消信号, 并自带一个自包含实现与一个订阅辅助函数.

## OhNetSignal

```ts
interface OhNetSignal {
  readonly aborted: boolean
  reason?: unknown
  addEventListener?: (type: "abort", listener: () => void) => void
  removeEventListener?: (type: "abort", listener: () => void) => void
  onAbort?: () => void
}
```

| 成员                  | 类型                       | 描述                                 |
| --------------------- | -------------------------- | ------------------------------------ |
| `aborted`             | `boolean`                  | 信号已中止后为 true. 始终存在.       |
| `reason`              | `unknown`                  | 传给 `abort()` 的值, 或 `undefined`. |
| `addEventListener`    | `(type, listener) => void` | 可选的 W3C 风格订阅.                 |
| `removeEventListener` | `(type, listener) => void` | 可选的 W3C 风格取消订阅.             |
| `onAbort`             | `() => void`               | 可选的单回调订阅; 赋值即替换.        |

接受三种订阅形态, 均可选: W3C (`addEventListener`), 回调 (`onAbort`), 或仅标志位 (直接轮询 `aborted`).

## OhNetController

```ts
class OhNetController implements OhNetSignal {
  get signal(): OhNetSignal
  get aborted(): boolean
  get reason(): unknown
  get onAbort(): (() => void) | undefined
  set onAbort(listener: (() => void) | undefined)

  addEventListener(type: "abort", listener: () => void): void
  removeEventListener(type: "abort", listener: () => void): void
  abort(reason?: unknown): void
}
```

一个轻量的 `AbortSignal` 实现, 不依赖浏览器或 Node 全局. `signal` 把 controller 自身作为 `OhNetSignal` 视图返回.

- 监听器只触发一次; `abort()` 后监听器集合会被清空.
- 重复 abort 是 no-op: 第一次 `abort()` 生效, 后续调用不会改变 `reason` 也不会再次通知.
- `addEventListener` 与 `removeEventListener` 会忽略除 `"abort"` 以外的类型.

```ts
const controller = new OhNetController()
controller.signal.addEventListener("abort", () => {
  console.log(controller.signal.reason)
})
controller.abort("user cancelled")
```

## subscribeAbort

```ts
function subscribeAbort(
  signal: OhNetSignal | null | undefined,
  listener: () => void,
): () => void
```

把 `listener` 订阅到 `signal` 并返回取消订阅函数.

| 情况                             | 行为                                                                |
| -------------------------------- | ------------------------------------------------------------------- |
| `signal` 为 `null` / `undefined` | 返回 no-op 取消订阅; 监听器永不运行.                                |
| `signal.aborted` 已为 `true`     | 同步运行 `listener` 并返回 no-op 取消订阅.                          |
| 存在 `signal.addEventListener`   | 挂接 W3C 监听器; 取消订阅会移除它.                                  |
| 只有 `signal.onAbort` 可用       | 设置 `onAbort`, 保留并串接此前的监听器. 取消订阅会恢复此前的监听器. |

```ts
const unsubscribe = subscribeAbort(controller.signal, () => abort())
```

## 下一步

- [适配器与上下文](./transport.md): 适配器遵守 `signal`.
- [错误](./errors.md): 取消会以 `OHNET_ABORT` 浮现.
- [Headers](./header.md): 另一个小型值类型.
