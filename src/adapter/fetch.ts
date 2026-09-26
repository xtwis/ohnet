import type { OhNetContext, OhNetMethod, OhNetResponse, OhNetResponseType } from "@/types"
import { OHNET_ADAPTER_ERROR_CODE, OHNET_ADAPTER_ERROR_MESSAGE, OhNetAdapterError } from "@/config/error"
import { createResponse } from "@/context/response"
import { OhNetHeader } from "@/model/header"
import { subscribeAbort } from "@/model/signal"

const FETCH_ADAPTER_AUTO_RETRIES_DEFAULT = 3
const FETCH_ADAPTER_RETRY_DELAY_MS = 300

const IDEMPOTENT_METHODS: readonly OhNetMethod[] = ["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isJsonData(data: unknown): boolean {
  if (typeof data !== "object" || data === null)
    return false
  const tag = Object.prototype.toString.call(data)
  return tag === "[object Object]" || tag === "[object Array]"
}

async function serializeBody(
  data: unknown,
  headers: OhNetHeader,
): Promise<unknown> {
  if (!isJsonData(data))
    return data
  if (!headers.has("content-type"))
    headers.set("content-type", "application/json")
  return JSON.stringify(data)
}

async function parseData(response: Response, responseType: OhNetResponseType): Promise<unknown> {
  switch (responseType) {
    case "text":
      return response.text()
    case "arraybuffer":
      return response.arrayBuffer()
    case "blob":
      return response.blob()
    case "stream":
      return response.body
    case "raw":
      return response
    case "json":
      return response.json().catch(() => null)
    default: {
      const contentType = response.headers.get("content-type") || ""
      return contentType.includes("application/json")
        ? response.json().catch(() => null)
        : response.text()
    }
  }
}

async function request(context: OhNetContext): Promise<OhNetResponse> {
  if (typeof globalThis.fetch !== "function") {
    throw new OhNetAdapterError(OHNET_ADAPTER_ERROR_CODE.NO_FETCH, OHNET_ADAPTER_ERROR_MESSAGE.NO_FETCH)
  }

  const { url, method, headers, data, signal, timeout, responseType } = context.request

  const controller = new AbortController()
  const unsubscribe = subscribeAbort(signal, () => controller.abort())

  let timedOut = false
  let timer: ReturnType<typeof setTimeout> | undefined
  if (timeout !== undefined) {
    timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeout)
  }

  const outgoingHeaders = headers.clone()
  const body = await serializeBody(data, outgoingHeaders)

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: outgoingHeaders.toRecord(),
      body: body as BodyInit | undefined,
      signal: controller.signal,
    })
  }
  catch (error) {
    if (timedOut) {
      throw new OhNetAdapterError(OHNET_ADAPTER_ERROR_CODE.TIMEOUT, OHNET_ADAPTER_ERROR_MESSAGE.TIMEOUT, undefined, error)
    }
    if (signal?.aborted) {
      throw new OhNetAdapterError(OHNET_ADAPTER_ERROR_CODE.ABORT, OHNET_ADAPTER_ERROR_MESSAGE.ABORT, signal.reason, error)
    }
    throw new OhNetAdapterError(OHNET_ADAPTER_ERROR_CODE.NETWORK, OHNET_ADAPTER_ERROR_MESSAGE.NETWORK, undefined, error)
  }
  finally {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
    unsubscribe()
  }

  const parsedData = await parseData(response, responseType)

  return createResponse({
    status: response.status,
    statusText: response.statusText,
    headers: OhNetHeader.from(response.headers),
    url: response.url,
    redirected: response.redirected,
    type: response.type,
    data: parsedData,
  })
}

/**
 * Default transport built on the global `fetch`.
 *
 * @remarks
 * Throws `OHNET_NO_FETCH` when `globalThis.fetch` is unavailable.
 * Bridges the user `signal`, enforces `request.timeout`, JSON-encodes
 * plain object / array bodies, and honors `request.autoRetries`.
 */
export async function fetchAdapter(context: OhNetContext): Promise<OhNetResponse> {
  const { method, autoRetries } = context.request

  let retries: number
  if (autoRetries === true) {
    retries = IDEMPOTENT_METHODS.includes(method) ? FETCH_ADAPTER_AUTO_RETRIES_DEFAULT : 0
  }
  else if (typeof autoRetries === "number" && autoRetries > 0) {
    retries = Math.min(autoRetries, FETCH_ADAPTER_AUTO_RETRIES_DEFAULT)
  }
  else {
    retries = 0
  }

  if (retries === 0) {
    return request(context)
  }

  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await request(context)
    }
    catch (error) {
      lastError = error
      if (attempt >= retries)
        break
      if (!(error instanceof OhNetAdapterError))
        break
      if (error.code !== OHNET_ADAPTER_ERROR_CODE.NETWORK && error.code !== OHNET_ADAPTER_ERROR_CODE.TIMEOUT)
        break
      await sleep(FETCH_ADAPTER_RETRY_DELAY_MS)
    }
  }

  throw lastError
}
