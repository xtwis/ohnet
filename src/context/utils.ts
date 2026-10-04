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
 * @description Serializes a query string source into an encoded string. Accepts a `string`, a `Record`, or an `Iterable<[name, value]>`. The result has no leading `?`.
 * @see https://x.twis.uk/en/ohnet/reference/transport.html#buildquerystring
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

/**
 * @description Appends `query` to `url` with the appropriate `?` or `&` separator; no-op when `query` is empty.
 * @see https://x.twis.uk/en/ohnet/reference/transport.html#buildquerystring
 */
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

/**
 * @internal
 * @description Returns a shallow clone of `context`: `request` and `response` (when present) are copied with cloned headers; `error` is shared by reference.
 */
export function copyContext(context: OhNetContext): OhNetContext {
  return {
    request: copyRequest(context.request),
    response: context.response ? copyResponse(context.response) : null,
    error: context.error,
    meta: { ...context.meta },
  }
}

/**
 * @internal
 * @description Returns a fresh context seeded with the default request.
 */
export function createDefaultContext(): OhNetContext {
  return {
    request: copyRequest(DEFAULT_OHNET_REQUEST),
    response: null,
    error: null,
    meta: {},
  }
}
