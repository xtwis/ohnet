---
layout: home
title: OhNet
order: 0

hero:
  name: "@xtwis/ohnet"
  text: Fluent, immutable HTTP client
  tagline: A middleware-pipelined, transport-agnostic HTTP client for building business-oriented request frameworks.
  actions:
    - theme: brand
      text: Get Started
      link: ./guide/getting-started.md
    - theme: alt
      text: API Reference
      link: ./reference/api.md
    - theme: alt
      text: GitHub
      link: https://github.com/xtwis/ohnet

features:
  - title: Zero Runtime Dependencies
    details: Bring your own adapter or use the built-in fetch adapter. Tiny bundle, tree-shakable, sideEffects-free.
  - title: Fluent Immutable Builder
    details: Every configuration call returns a new instance. Safe to derive, fork, and share across requests without mutation bugs.
  - title: Middleware Pipeline
    details: Declarative enter/leave hooks with skip, terminate, and retry controls. Compose auth, caching, envelope unwrapping, and more.
  - title: Pluggable Transport
    details: Swap the adapter to use gRPC, WebSocket, axios, XMLHttpRequest, or in-memory mocks. The pipeline stays unchanged.
  - title: Unified Error System
    details: Three-layer error hierarchy (internal, adapter, unknown). Branch on code, not message, with instanceof discrimination.
  - title: TypeScript-First
    details: Full type inference across the pipeline. request&lt;T&gt;() infers response shape from responseType.
---
