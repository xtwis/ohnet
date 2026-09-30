---
title: Error Handling
order: 6
---

# {{ $frontmatter.title }}

Errors are ohnet's structured exit point. Every failure flows through a single hierarchy so catch sites can branch reliably without guessing what went wrong.

## Why Two Layers of Classification

Every `OhNetError` carries two fields:

```ts
class OhNetError extends Error {
  type: string // which subsystem failed
  code: string // what specifically went wrong
  message: string // human-readable
  error?: unknown // underlying cause
}
```

`type` separates concerns: **internal** (the framework decided not to give you a response), **adapter** (the transport failed), or **unknown** (something else bubbled up from your code). `code` then picks the specific failure mode inside that subsystem.

The split exists so catch sites can branch coarse-or-fine: ask "is this an adapter problem?" with `type`, then "which one?" with `code`.

**Branch on `code`, treat `message` as human-only.** Messages are advisory and can change between releases.

## Catching in Practice

The pattern that covers most real cases:

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

Three rules that hold across the codebase:

1. **Re-throw what isn't yours.** Non-`OhNetError` values usually mean a bug; letting them through silently hides real failures.
2. **Branch on `code`, not `message`.** Messages change; codes are stable.
3. **Always have a `default`.** A new `code` means a new failure mode: surface it loudly, don't swallow it.

For concrete retry strategies, see [Middleware Recipes](../example/middleware.md).

## Throwing Errors

Where the error originates changes the contract.

**From your middleware:** throw an `OhNetError` subclass with a code you define for your domain (e.g. `OHNET_AUTH`). Anything thrown that isn't an `OhNetError` is caught by the dispatcher and re-wrapped as an `OhNetError` whose `type` and `code` are both `OHNET_UNKNOWN`. The original is preserved on `error.error` for debugging, but the structured `code` is lost. Throw structured errors to keep catch sites branchable.

**From a custom adapter:** throw `OhNetAdapterError` with one of the `OHNET_ADAPTER_ERROR_CODE` constants (`NETWORK`, `TIMEOUT`, `ABORT`, `NO_FETCH`). This lets catch sites distinguish transport failures from framework failures without inspecting the underlying transport object. See [Adapter](./adapter.md) for a complete adapter template.

In short: middleware errors carry _your_ semantics; adapter errors carry _transport_ semantics. Mixing them up blurs who can recover from what.

## Next

- [HTTP Requests](./http.md): `responseType`, `params`, and per-request options.
- [Building a Business API Client](../example/business-client.md): practical error-mapping patterns.
