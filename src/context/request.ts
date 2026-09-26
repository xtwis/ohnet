import type { OhNetRequestConfig } from "@/context/types"
import type { OhNetRequest } from "@/types"

/**
 * Merges a partial config into a base request and returns a new
 * request; `base` is not mutated. The header collection is always
 * cloned, even when `config.headers` is omitted, so the result does
 * not share storage with `base`.
 */
export function resolveRequest(base: OhNetRequest, config: OhNetRequestConfig): OhNetRequest {
  const request: OhNetRequest = { ...base, headers: base.headers.clone() }

  if (config.url !== undefined)
    request.url = config.url
  if (config.method !== undefined)
    request.method = config.method
  if (config.headers !== undefined)
    request.headers = request.headers.concat(config.headers)
  if (config.params !== undefined)
    request.params = config.params
  if (config.signal !== undefined)
    request.signal = config.signal
  if (config.timeout !== undefined)
    request.timeout = config.timeout
  if (config.middlewareRetries !== undefined)
    request.middlewareRetries = config.middlewareRetries
  if (config.autoRetries !== undefined)
    request.autoRetries = config.autoRetries
  if (config.responseType !== undefined)
    request.responseType = config.responseType
  if (config.data !== undefined)
    request.data = config.data

  return request
}
