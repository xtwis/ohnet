import type { OhNetResponseLike } from "@/context/types"
import type { OhNetResponse } from "@/types"
import { OhNetHeader } from "@/model/header"

/**
 * @description Normalizes an adapter-supplied response into {@link OhNetResponse}, filling in optional fields with sensible defaults.
 * @see https://x.twis.uk/en/ohnet/reference/transport.html#createresponse
 */
export function createResponse<T>(input: OhNetResponseLike<T>): OhNetResponse<T> {
  const status = input.status
  const result: OhNetResponse<T> = {
    status,
    statusText: input.statusText ?? "",
    ok: input.ok ?? (status >= 200 && status < 300),
    headers: OhNetHeader.from(input.headers),
    url: input.url,
    redirected: input.redirected ?? false,
    type: input.type ?? "default",
    data: input.data as T,
    body: input.body,
  }
  return result
}
