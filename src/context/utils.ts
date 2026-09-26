import type { OhNetContext, OhNetParams, OhNetRequest, OhNetResponse } from "@/types"
import { DEFAULT_OHNET_REQUEST } from "@/config/request"

function isIterable(value: unknown): value is Iterable<unknown> {
  return typeof value === "object" && value !== null
    && typeof (value as Iterable<unknown>)[Symbol.iterator] === "function"
}

function stringifyPair(key: string, value: unknown): string[] {
  if (value === undefined || value === null)
    return []
  if (Array.isArray(value))
    return value.flatMap(item => stringifyPair(key, item))
  return [`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`]
}

/**
 * Serializes a query string source into an encoded string.
 *
 * @remarks
 * Three input shapes are accepted (see {@link OhNetParams}):
 * - `string` - returned verbatim after stripping a leading `?`.
 * - `Record<string, unknown>` - entries are URL-encoded in insertion
 *   order. Arrays expand into repeated keys (`tag=a&tag=b`); `null`
 *   and `undefined` values are skipped.
 * - `Iterable<[name, value]>` - raw pair iteration for callers that
 *   need to preserve order or emit duplicate keys.
 *
 * The result has no leading `?`. Callers that append the result to a
 * URL are responsible for adding the separator (see {@link appendQuery}).
 *
 * @param params - Query string source in any accepted shape.
 */
export function buildQueryString(params: OhNetParams): string {
  if (typeof params === "string")
    return params.replace(/^\?/, "")

  const pairs: string[] = []

  if (isIterable(params)) {
    for (const entry of params as Iterable<readonly string[]>)
      pairs.push(...stringifyPair(entry[0], entry[1]))
  }
  else {
    for (const [key, value] of Object.entries(params as Record<string, unknown>))
      pairs.push(...stringifyPair(key, value))
  }

  return pairs.join("&")
}

/** Appends `query` to `url` with the appropriate `?` or `&` separator; no-op when `query` is empty. */
export function appendQuery(url: string, query: string): string {
  if (!query)
    return url
  return `${url}${url.includes("?") ? "&" : "?"}${query}`
}

function copyRequest(request: OhNetRequest): OhNetRequest {
  return {
    ...request,
    headers: request.headers.clone(),
  }
}

function copyResponse(response: OhNetResponse): OhNetResponse {
  return {
    ...response,
    headers: response.headers.clone(),
  }
}

/** Returns a shallow clone of `context` with a deep-cloned request, a fresh `meta` bag, and a cloned response when present. */
export function copyContext(context: OhNetContext): OhNetContext {
  return {
    request: copyRequest(context.request),
    response: context.response ? copyResponse(context.response) : null,
    error: context.error,
    meta: { ...context.meta },
  }
}

/** Returns a fresh context seeded with the default {@link DEFAULT_OHNET_REQUEST}. */
export function createDefaultContext(): OhNetContext {
  return {
    request: copyRequest(DEFAULT_OHNET_REQUEST),
    response: null,
    error: null,
    meta: {},
  }
}
