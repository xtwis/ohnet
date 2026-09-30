---
title: 错误处理
order: 6
---

# {{ $frontmatter.title }}

错误是 ohnet 的结构化出口. 所有失败都流经一个统一的层次, 因此 catch 处可以可靠地分支, 而不需要猜测哪里出了问题.

## 为什么分两层

每个 `OhNetError` 携带两个字段:

```ts
class OhNetError extends Error {
  type: string // which subsystem failed
  code: string // what specifically went wrong
  message: string // human-readable
  error?: unknown // underlying cause
}
```

`type` 划分职责: **internal** (框架决定不给你响应), **adapter** (传输失败), 或 **unknown** (其他从你代码里冒泡上来). `code` 进一步挑选该子系统内的具体失败模式.

这样划分是为了让 catch 处既能粗也能细地分支: 用 `type` 判断 "是不是适配器问题", 再用 `code` 判断 "是哪一个".

**以 `code` 分支, 把 `message` 当作人话.** message 只是建议, 跨版本可能变化.

## 实战 catch

能覆盖大多数真实场景的模式:

```ts
import { OHNET_ADAPTER_ERROR_CODE, OhNetError } from "@xtwis/ohnet"

try {
  await client.get("/items")
}
catch (error) {
  if (!(error instanceof OhNetError))
    throw error // not ours, re-throw

  switch (error.code) {
    case OHNET_ADAPTER_ERROR_CODE.TIMEOUT:
      return retry()
    case OHNET_ADAPTER_ERROR_CODE.NETWORK:
      return showOfflineUI()
    default:
      throw error // unknown mode, surface it
  }
}
```

贯穿代码库的三条规则:

1. **不属于你的就抛回去.** 非 `OhNetError` 值通常意味着 bug, 静默放行会掩盖真实失败.
2. **以 `code` 分支, 不依赖 `message`.** message 会变, code 是稳定的.
3. **永远有 `default`.** 一个新的 `code` 意味着一种新的失败模式: 大声抛出来, 不要吞掉.

具体的重试策略见 [中间件食谱](../example/middleware.md).

## 主动抛错

错误来自哪里改变了契约.

**从你的中间件:** 抛一个 `OhNetError` 子类, 带一个你为业务域定义的 code (例如 `OHNET_AUTH`). 任何非 `OhNetError` 的抛出都会被调度器捕获, 并重新包装为 `type` 和 `code` 均为 `OHNET_UNKNOWN` 的 `OhNetError`. 原值会保留在 `error.error` 供调试, 但结构化的 `code` 丢失. 抛结构化的错误, 让 catch 处保持可分支.

**从自定义适配器:** 抛 `OhNetAdapterError`, 使用 `OHNET_ADAPTER_ERROR_CODE` 常量之一 (`NETWORK`, `TIMEOUT`, `ABORT`, `NO_FETCH`). 这让 catch 处能区分传输失败和框架失败, 而不用打开传输底层对象. 完整适配器模板见 [Adapter](./adapter.md).

简而言之: middleware 错误携带**你的**语义, adapter 错误携带**传输的**语义. 混用会让"谁能恢复什么"变得模糊.

## 下一步

- [HTTP Requests](./http.md): `responseType`, `params`, 以及每请求选项.
- [构建业务 API 客户端](../example/business-client.md): 实用的错误映射模式.
