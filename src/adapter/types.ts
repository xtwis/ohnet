import type { OhNetContext, OhNetResponse } from "@/types"

/**
 * @description Transport contract every adapter implements: receives the resolved request, returns a normalized {@link OhNetResponse}.
 * @see https://x.twis.uk/en/ohnet/reference/transport.html#ohnetadapter
 */
export type OhNetAdapter = (context: OhNetContext) => Promise<OhNetResponse>
