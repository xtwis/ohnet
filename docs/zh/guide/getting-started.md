---
title: 快速开始
order: 1
---

# {{ $frontmatter.title }}

欢迎使用 ohnet. 本页带你从零到发出第一个请求, 耗时不到五分钟.

## 安装

通过你常用的包管理器安装:

```bash
# pnpm
pnpm add @xtwis/ohnet

# npm
npm install @xtwis/ohnet

# yarn
yarn add @xtwis/ohnet
```

**环境要求.** TypeScript 4.5+, 或任何支持 `fetch` 的现代 JavaScript 运行时: Node 18+, 现代浏览器, Deno, Bun, Cloudflare Workers, Vercel Edge 等.

## 你的第一个请求

一个可用的客户端只要两行:

```ts
import { OhNetBuilder } from "@xtwis/ohnet"

const client = new OhNetBuilder({ url: "https://api.example.com" })

const user = await client.get<{ id: string, name: string }>("/users/1")
console.log(user.id, user.name)
```

就这些. Builder 是流畅且不可变的: 每次配置调用都返回新实例, 因此原实例可以安全共享, 你也可以从中派生子客户端.

## 刚刚发生了什么

- `new OhNetBuilder({ url })` 创建了一个根 URL 为 `https://api.example.com` 的客户端.
- `client.get<T>(path)` 对拼接后的 URL 发出 HTTP `GET` 请求.
- `<T>` 是 `response.data` 的期望类型. ohnet 会把类型向下游传递.
- 如果没有传 `adapter`, ohnet 使用内置的 fetch 适配器, 适用于任何暴露标准 `fetch` 全局的运行时.

## 添加中间件

中间件是主要的扩展点. 继承 `OhNetMiddleware` 并通过 `.with(...)` 注册:

```ts
import type { OhNetContext } from "@xtwis/ohnet"
import { OhNetBuilder, OhNetMiddleware } from "@xtwis/ohnet"

class TimingMiddleware extends OhNetMiddleware {
  readonly name = "timing"

  enter(_adapter, context) {
    context.meta.startedAt = Date.now()
  }

  leave(_adapter, context) {
    const started = context.meta.startedAt as number
    console.log(`elapsed: ${Date.now() - started}ms`)
  }
}

const client = new OhNetBuilder({ url: "https://api.example.com" })
  .with(new TimingMiddleware())

await client.get("/users/1") // logs "elapsed: 87ms"
```

`enter` 钩子在适配器之前按注册顺序执行; `leave` 钩子在适配器之后按相反顺序执行.

## 下一步

- 阅读 [核心概念](./concepts.md) 了解高层心智模型: Builder, Pipeline, Adapter.
- 通过侧边栏浏览指南的其余部分, 或跳转到 [API 参考](../reference/api.md).
