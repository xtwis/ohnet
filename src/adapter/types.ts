import type { OhNetContext, OhNetResponse } from "@/types"

/**
 * Transport contract every adapter implements.
 *
 * @remarks
 * An adapter takes the request assembled by the pipeline and returns a
 * normalized {@link OhNetResponse}. It owns the actual HTTP call; the
 * rest of the library is transport-agnostic and works against any
 * implementation that satisfies this signature.
 *
 * The adapter is invoked once per non-skipped request. By that point
 * every middleware `enter` hook has run, so the URL, headers, body,
 * signal, and timeout already reflect the full pipeline. Adapters
 * must not mutate `context`; they return a response that
 * {@link createResponse} normalizes into the final shape.
 *
 * Errors thrown by the adapter are surfaced through `context.error`:
 * - `OhNetError` instances are preserved as-is.
 * - Anything else is wrapped in {@link OhNetUnknownError} with the
 *   original value on `error.error`.
 * - Returning without a response when no error is set produces
 *   `OHNET_NO_RESPONSE`.
 *
 * @example
 * ```ts
 * const adapter: OhNetAdapter = async (context) => {
 *   const res = await undici.fetch(context.request.url, {
 *     method: context.request.method,
 *     headers: context.request.headers.toRecord(),
 *     body: context.request.data as BodyInit | undefined,
 *   })
 *   return createResponse({
 *     status: res.status,
 *     headers: res.headers,
 *     url: res.url,
 *     data: await res.text(),
 *   })
 * }
 * ```
 */
export type OhNetAdapter = (context: OhNetContext) => Promise<OhNetResponse>
