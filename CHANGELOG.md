# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [2.0.0] - 2026-10-18

### Breaking Changes

- Public class `OhNetBuilder` renamed to `OhNetClient`; the constructor is now private. Construct via `OhNetClient.create(config)`.
- `fork` signature changed: `(config?: OhNetConfig) => OhNetClient` to `(options?: { adapter?, context?, middlewares?, events? }) => OhNetClient`. Each omitted field is inherited from the receiver; `middlewares` and `events` are copied by default.
- `add(config)` no longer aliases `fork(config)`. It only affects request-shaped fields (`url`, `method`, `headers`, `params`, `data`, `signal`, `timeout`, `middlewareRetries`, `autoRetries`, `responseType`); middleware / event / adapter overrides must go through `fork`.
- `get middleware()` / `get event()` getters replaced by `middlewares()` / `events()` methods.
- Type names `OhNetMiddlewareBuilder` / `OhNetEventBuilder` removed. Replaced by `OhNetMiddlewareQuery` / `OhNetEventQuery`, which are now internal types (not re-exported from the public entry).
- Documentation URL `reference/builder.html` moved to `reference/client.html`; the in-source `@see` anchors have been updated.

### Added

- Strict immutability: the four state fields (`#adapter`, `#context`, `#middlewares`, `#events`) are declared `readonly` with `readonly` container types. Every mutator (`with`, `clean`, `on`, `off`, `add`, `fork`, `append`) returns a fresh instance.
- `OhNetMiddlewareQuery` and `OhNetEventQuery` expose a `get(name | event)` method that returns the first match or `undefined`.
- A migration guide at `docs/en/v1.md` (and `docs/zh/v1.md`) walking through each breaking change with Before/After diffs.

### Changed

- Dispatcher signature: `compose(... , events?: OhNetEventBuilder)` to `compose(... , emit?: (event, context) => void)`. The builder passes a fresh closure that calls `private emit(event, context)`; the dispatcher no longer needs to know about `OhNetEventBuilder`.
- The dispatcher receives a caller-provided `runContext` (a copy of `this.#context`) and mutates it in place; the receiver's `#context` is never touched. `run()` reads response / error / url from the returned context, not `this.#context`.

### Internal

- `fork` is now the single derivation primitive: it accepts a 4-field options object, applies the override, and constructs a new instance via the private 4-argument constructor. `create` calls the constructor directly; `add` derives a `childContext` and calls `fork({ context: childContext })`; mutators (`with` / `clean` / `on` / `off`) build a fresh array / map locally and call `fork({ middlewares | events })` without ever mutating a child.
- `fork` defaults copy the receiver's `middlewares` and `events` by value, so an empty `fork()` produces an independently mutable instance.
- Source layout: `src/builder/` renamed to `src/client/`.

## [1.0.1] - 2026-10-04

### Changed

- In-source jsdoc / comments simplified: long-form descriptions now point to the docs site via `@see` links. The detailed prose lives at `docs/en/` (and `docs/zh/`); the source carries only the API surface summary.

### Internal

- ci: GitHub Actions workflow setup for pr-merged synchronization, manual update capability, and a sync script.
- docs site: full reference, example, and guide content authored against the `@xtwis/ohdoc` layout (which is now in devDependencies), including signal-related content, the API reference, the example suite, and the sidebar configuration.
- Remove unused dependencies surfaced during the docs build.

## [1.0.0] - 2026-09-27

### Added

- Initial release of `@xtwis/ohnet`: a fluent, immutable HTTP client with a middleware pipeline. Includes the `OhNetBuilder` API, `with` / `clean` / `on` / `off` / `append` mutators, the `get middleware()` / `get event()` introspection getters, lifecycle events (`OHNET_EVENT`), and a built-in `fetchAdapter`.
- Three-layer error model (`OhNetInternalError` / `OhNetAdapterError` / `OhNetUnknownError`) with codes under `OHNET_ERROR_CODE` and a `code`-based branching contract.
