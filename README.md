<div align="center">

# @xtwis/ohnet

Fluent, immutable HTTP client with middleware pipeline for building business-oriented request frameworks.

[![npm version](https://img.shields.io/npm/v/@xtwis/ohnet)](https://www.npmjs.com/package/@xtwis/ohnet)
[![CI](https://img.shields.io/github/actions/workflow/status/xtwis/ohnet/ci.yml?branch=main)](https://github.com/xtwis/ohnet/actions)
[![License](https://img.shields.io/npm/l/@xtwis/ohnet)](./LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@xtwis/ohnet)](https://bundlephobia.com/package/@xtwis/ohnet)

</div>

```ts
new OhNetBuilder({ url: "https://api.example.com" }).get<{ id: string, name: string }>("/users/1")
```

- **Fluent Immutable Builder**: Every configuration call returns a new instance. Safe to derive child clients without mutating shared state.
- **Middleware Pipeline**: Declarative enter/leave hooks with skip, terminate, and retry controls for each phase.
- **Pluggable Transport**: Swap the adapter to use gRPC, WebSocket, axios, XMLHttpRequest, or in-memory mocks. The pipeline stays unchanged.
- **Unified Error System**: Three-layer hierarchy (internal, adapter, unknown). Branch on `code`, not `message`, with `instanceof` discrimination.
- **Lifecycle Events**: 8 hooks for tracing, logging, and metrics; handler exceptions are swallowed.
- **Zero Runtime Dependencies**: Bring your own adapter or use the built-in `fetchAdapter`.
- **TypeScript-first**: Full type inference across the pipeline.

## Installation

```bash
pnpm add @xtwis/ohnet
# or
npm install @xtwis/ohnet
# or
yarn add @xtwis/ohnet
```

## Quick Start

```ts
import { OhNetBuilder } from "@xtwis/ohnet"

const client = new OhNetBuilder({ url: "https://api.example.com" })

const user = await client.get<{ id: string, name: string }>("/users/1")
console.log(user.id, user.name)
```

## Documentation

Full guides, API reference, and examples live at:

- English: <https://x.twis.uk/en/ohnet/>
- 简体中文: <https://x.twis.uk/zh/ohnet/>

## License

[MIT](./LICENSE)
