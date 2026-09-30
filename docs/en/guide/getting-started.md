---
title: Getting Started
order: 1
---

# {{ $frontmatter.title }}

Welcome to ohnet. This page takes you from zero to your first request in under five minutes.

## Installation

Install via your favorite package manager:

```bash
# pnpm
pnpm add @xtwis/ohnet

# npm
npm install @xtwis/ohnet

# yarn
yarn add @xtwis/ohnet
```

**Requirements.** TypeScript 4.5+, or any modern JavaScript runtime with `fetch` support: Node 18+, modern browsers, Deno, Bun, Cloudflare Workers, Vercel Edge, and similar.

## Your First Request

A working client is two lines:

```ts
import { OhNetBuilder } from "@xtwis/ohnet"

const client = new OhNetBuilder({ url: "https://api.example.com" })

const user = await client.get<{ id: string, name: string }>("/users/1")
console.log(user.id, user.name)
```

That's it. The builder is fluent and immutable: every configuration call returns a new instance, so the original is safe to share and you can derive children from it.

## What Just Happened?

- `new OhNetBuilder({ url })` creates a client rooted at `https://api.example.com`.
- `client.get<T>(path)` issues an HTTP `GET` against the joined URL.
- `<T>` is the expected shape of `response.data`. ohnet propagates the type everywhere downstream.
- Without an `adapter`, ohnet uses a built-in fetch-based adapter, fine for any runtime that exposes a standard `fetch` global.

## Adding a Middleware

Middlewares are the main extension point. Subclass `OhNetMiddleware` and register with `.with(...)`:

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

`enter` hooks fire before the adapter in registration order; `leave` hooks fire after the adapter in reverse order.

## Next Steps

- Read [Concepts](./concepts.md) for the high-level mental model: Builder, Pipeline, Adapter.
- Browse the rest of the guide from the sidebar, or jump to [API Reference](../reference/api.md).
