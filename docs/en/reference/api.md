---
title: API Reference
order: 0
---

# {{ $frontmatter.title }}

The complete public surface of `@xtwis/ohnet`, split by topic. Every symbol listed here is exported from the package entry point; nothing else is public.

## Install and Import

```bash
pnpm add @xtwis/ohnet
# or
npm install @xtwis/ohnet
```

```ts
import { OhNetBuilder } from "@xtwis/ohnet"
```

## Reading This Reference

- Signatures are TypeScript. A trailing `?` marks an optional parameter or property.
- On the request methods, the generic `T` is the type of `response.data`.
- `request<T>()` resolves with `response.data`, not with the `OhNetResponse` wrapper.
- Every error the library throws is an `OhNetError`; branch on `code`, not `message`. See [Errors](./errors.md).

## Export Map

### Classes

| Symbol              | Page                                                     |
| ------------------- | -------------------------------------------------------- |
| `OhNetBuilder`      | [Builder](./builder.md#ohnetbuilder)                     |
| `OhNetMiddleware`   | [Middleware and Events](./middleware.md#ohnetmiddleware) |
| `OhNetHeader`       | [Headers](./header.md#ohnetheader)                       |
| `OhNetController`   | [Signals](./signal.md#ohnetcontroller)                   |
| `OhNetError`        | [Errors](./errors.md#ohneterror)                         |
| `OhNetAdapterError` | [Errors](./errors.md#ohnetadaptererror)                  |

### Functions

| Symbol             | Page                                                   |
| ------------------ | ------------------------------------------------------ |
| `createResponse`   | [Adapter and Context](./transport.md#createresponse)   |
| `buildQueryString` | [Adapter and Context](./transport.md#buildquerystring) |
| `subscribeAbort`   | [Signals](./signal.md#subscribeabort)                  |

### Constants

| Symbol                                                                                  | Page                                                 |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `OHNET_EVENT`                                                                           | [Middleware and Events](./middleware.md#ohnet_event) |
| `OHNET_ERROR_TYPE` / `OHNET_ERROR_CODE` / `OHNET_ERROR_MESSAGE`                         | [Errors](./errors.md)                                |
| `OHNET_ADAPTER_ERROR_TYPE` / `OHNET_ADAPTER_ERROR_CODE` / `OHNET_ADAPTER_ERROR_MESSAGE` | [Errors](./errors.md)                                |
| `OHNET_UNKNOWN_ERROR_TYPE` / `OHNET_UNKNOWN_ERROR_CODE` / `OHNET_UNKNOWN_ERROR_MESSAGE` | [Errors](./errors.md)                                |

### Types

| Symbol                                                                                                  | Page                                                    |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `OhNetAdapter`                                                                                          | [Adapter and Context](./transport.md#ohnetadapter)      |
| `OhNetContext`, `OhNetRequest`, `OhNetResponse`                                                         | [Adapter and Context](./transport.md)                   |
| `OhNetResponseLike`                                                                                     | [Adapter and Context](./transport.md#ohnetresponselike) |
| `OhNetMethod`, `OhNetParams`, `OhNetResponseType`, `OhNetResponseKind`                                  | [Adapter and Context](./transport.md)                   |
| `OhNetConfig`, `OhNetRequestConfig`                                                                     | [Builder](./builder.md#ohnetconfig)                     |
| `OhNetMiddlewareEnterControls`, `OhNetMiddlewareLeaveControls`                                          | [Middleware and Events](./middleware.md)                |
| `OhNetEventHandler`, `OhNetEventName`                                                                   | [Middleware and Events](./middleware.md)                |
| `OhNetHeaderLike`, `OhNetHeaderRecord`, `OhNetHeaderEntry`, `OhNetHeaderEntries`, `OhNetHeaderIterable` | [Headers](./header.md)                                  |
| `OhNetSignal`                                                                                           | [Signals](./signal.md#ohnetsignal)                      |

## Quick Example

```ts
import { OhNetBuilder } from "@xtwis/ohnet"

const client = new OhNetBuilder({ url: "https://api.example.com" })
const user = await client.get<{ id: string, name: string }>("/users/1")
```

## Internal Errors

`OhNetInternalError` and `OhNetUnknownError` are internal and are not exported. Identify those failures by the exported `type` and `code` constants in [Errors](./errors.md).

## Next

- [Builder](./builder.md): the entry point and its configuration.
- [Middleware and Events](./middleware.md): hooks, controls, and lifecycle events.
- [Adapter and Context](./transport.md): the transport contract and request/response types.
- [Errors](./errors.md): classes and constants.
- [Headers](./header.md): the multi-value header collection.
- [Signals](./signal.md): cancellation primitives.
