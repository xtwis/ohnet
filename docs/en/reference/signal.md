---
title: Signals
order: 6
---

# {{ $frontmatter.title }}

ohNet accepts any abort signal that matches a small duck-typed interface, and ships a self-contained implementation plus a subscription helper.

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

| Member                | Type                       | Description                                                   |
| --------------------- | -------------------------- | ------------------------------------------------------------- |
| `aborted`             | `boolean`                  | True once the signal has aborted. Always present.             |
| `reason`              | `unknown`                  | Value passed to `abort()`, or `undefined`.                    |
| `addEventListener`    | `(type, listener) => void` | Optional W3C-style subscription.                              |
| `removeEventListener` | `(type, listener) => void` | Optional W3C-style unsubscription.                            |
| `onAbort`             | `() => void`               | Optional single-callback subscription; assigning replaces it. |

Three subscription shapes are accepted, all optional: W3C (`addEventListener`), callback (`onAbort`), or flag-only (`aborted` polled directly).

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

A lightweight `AbortSignal` implementation that does not depend on browser or Node globals. `signal` returns the controller itself as an `OhNetSignal` view.

- Listeners fire exactly once; the listener set is cleared after `abort()`.
- Re-aborting is a no-op: the first `abort()` call wins, and later calls do not change `reason` or re-notify.
- `addEventListener` and `removeEventListener` ignore any type other than `"abort"`.

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

Subscribes `listener` to `signal` and returns an unsubscribe function.

| Case                                 | Behavior                                                                                                       |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `signal` is `null` / `undefined`     | Returns a no-op unsubscribe; the listener never runs.                                                          |
| `signal.aborted` is already `true`   | Runs `listener` synchronously and returns a no-op unsubscribe.                                                 |
| `signal.addEventListener` is present | Attaches a W3C listener; the unsubscribe removes it.                                                           |
| Only `signal.onAbort` is available   | Sets `onAbort`, preserving and chaining any previous listener. The unsubscribe restores the previous listener. |

```ts
const unsubscribe = subscribeAbort(controller.signal, () => abort())
```

## Next

- [Adapter and Context](./transport.md): adapters honor `signal`.
- [Errors](./errors.md): an abort surfaces as `OHNET_ABORT`.
- [Headers](./header.md): the other small value type.
