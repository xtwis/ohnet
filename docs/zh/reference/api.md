---
title: API 参考
order: 0
---

# {{ $frontmatter.title }}

`@xtwis/ohnet` 的完整公开接口, 按主题拆分. 本页列出的所有符号都从包入口导出; 其余均不是公开接口.

## 安装与导入

```bash
pnpm add @xtwis/ohnet
# or
npm install @xtwis/ohnet
```

```ts
import { OhNetBuilder } from "@xtwis/ohnet"
```

## 如何阅读本参考

- 签名使用 TypeScript. 结尾的 `?` 表示可选参数或属性.
- 请求方法上的泛型 `T` 是 `response.data` 的类型.
- `request<T>()` resolve 的是 `response.data`, 而不是 `OhNetResponse` 包装层.
- 库抛出的每个错误都是 `OhNetError`; 按 `code` 分支, 不要依赖 `message`. 见 [错误](./errors.md).

## 导出总览

### 类

| 符号                | 页面                                            |
| ------------------- | ----------------------------------------------- |
| `OhNetBuilder`      | [Builder](./builder.md#ohnetbuilder)            |
| `OhNetMiddleware`   | [中间件与事件](./middleware.md#ohnetmiddleware) |
| `OhNetHeader`       | [Headers](./header.md#ohnetheader)              |
| `OhNetController`   | [信号](./signal.md#ohnetcontroller)             |
| `OhNetError`        | [错误](./errors.md#ohneterror)                  |
| `OhNetAdapterError` | [错误](./errors.md#ohnetadaptererror)           |

### 函数

| 符号               | 页面                                              |
| ------------------ | ------------------------------------------------- |
| `createResponse`   | [适配器与上下文](./transport.md#createresponse)   |
| `buildQueryString` | [适配器与上下文](./transport.md#buildquerystring) |
| `subscribeAbort`   | [信号](./signal.md#subscribeabort)                |

### 常量

| 符号                                                                                    | 页面                                        |
| --------------------------------------------------------------------------------------- | ------------------------------------------- |
| `OHNET_EVENT`                                                                           | [中间件与事件](./middleware.md#ohnet_event) |
| `OHNET_ERROR_TYPE` / `OHNET_ERROR_CODE` / `OHNET_ERROR_MESSAGE`                         | [错误](./errors.md)                         |
| `OHNET_ADAPTER_ERROR_TYPE` / `OHNET_ADAPTER_ERROR_CODE` / `OHNET_ADAPTER_ERROR_MESSAGE` | [错误](./errors.md)                         |
| `OHNET_UNKNOWN_ERROR_TYPE` / `OHNET_UNKNOWN_ERROR_CODE` / `OHNET_UNKNOWN_ERROR_MESSAGE` | [错误](./errors.md)                         |

### 类型

| 符号                                                                                                    | 页面                                               |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `OhNetAdapter`                                                                                          | [适配器与上下文](./transport.md#ohnetadapter)      |
| `OhNetContext`, `OhNetRequest`, `OhNetResponse`                                                         | [适配器与上下文](./transport.md)                   |
| `OhNetResponseLike`                                                                                     | [适配器与上下文](./transport.md#ohnetresponselike) |
| `OhNetMethod`, `OhNetParams`, `OhNetResponseType`, `OhNetResponseKind`                                  | [适配器与上下文](./transport.md)                   |
| `OhNetConfig`, `OhNetRequestConfig`                                                                     | [Builder](./builder.md#ohnetconfig)                |
| `OhNetMiddlewareEnterControls`, `OhNetMiddlewareLeaveControls`                                          | [中间件与事件](./middleware.md)                    |
| `OhNetEventHandler`, `OhNetEventName`                                                                   | [中间件与事件](./middleware.md)                    |
| `OhNetHeaderLike`, `OhNetHeaderRecord`, `OhNetHeaderEntry`, `OhNetHeaderEntries`, `OhNetHeaderIterable` | [Headers](./header.md)                             |
| `OhNetSignal`                                                                                           | [信号](./signal.md#ohnetsignal)                    |

## 快速示例

```ts
import { OhNetBuilder } from "@xtwis/ohnet"

const client = new OhNetBuilder({ url: "https://api.example.com" })
const user = await client.get<{ id: string, name: string }>("/users/1")
```

## 内部错误

`OhNetInternalError` 和 `OhNetUnknownError` 是内部实现, 不对外导出. 请用 [错误](./errors.md) 中导出的 `type` 和 `code` 常量识别它们.

## 下一步

- [Builder](./builder.md): 入口及其配置.
- [中间件与事件](./middleware.md): 钩子, 控制与生命周期事件.
- [适配器与上下文](./transport.md): 传输契约与请求/响应类型.
- [错误](./errors.md): 类与常量.
- [Headers](./header.md): 多值 header 集合.
- [信号](./signal.md): 取消原语.
