import type { OhNetResponseLike } from "@/context/types"
import type { OhNetResponse } from "@/types"
import { OhNetHeader } from "@/model/header"

/**
 * Normalizes an adapter-supplied response into {@link OhNetResponse}.
 *
 * @remarks
 * Fills in optional fields with sensible defaults: `statusText` defaults
 * to an empty string, `ok` defaults to `status` in the 200-299 range,
 * `redirected` defaults to `false`, `type` defaults to `"default"`. The
 * header collection is rebuilt through {@link OhNetHeader.from}, so the
 * result does not share storage with the input.
 *
 * @typeParam T - Type of the decoded `data` payload.
 * @param input - Loose response shape produced by an adapter.
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
