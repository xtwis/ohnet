---
layout: home
title: OhNet
order: 0

hero:
  name: "@xtwis/ohnet"
  text: 流畅, 不可变的 HTTP 客户端
  tagline: 基于中间件管道, 传输无关的 HTTP 客户端, 用于构建面向业务的请求框架.
  actions:
    - theme: brand
      text: 快速开始
      link: ./guide/getting-started.md
    - theme: alt
      text: API 参考
      link: ./reference/api.md
    - theme: alt
      text: GitHub
      link: https://github.com/xtwis/ohnet

features:
  - title: 零运行时依赖
    details: 自带适配器或使用内置的 fetch 适配器. 包体小, 支持 tree-shaking, 无副作用.
  - title: 流畅不可变 Builder
    details: 每次配置调用都返回新实例. 可安全派生, fork, 跨请求共享, 无变更错误.
  - title: 中间件管道
    details: 声明式 enter/leave 钩子, 支持 skip, terminate, retry 控制. 可组合鉴权, 缓存, 信封解包等.
  - title: 可插拔传输
    details: 替换适配器即可使用 gRPC, WebSocket, axios, XMLHttpRequest 或内存 mock. 管道逻辑保持不变.
  - title: 统一错误体系
    details: 三层错误层次 (internal, adapter, unknown). 用 instanceof + code 分支, 不依赖 message.
  - title: TypeScript 优先
    details: 全链路类型推断. request<T>() 根据 responseType 推断响应结构.
---
