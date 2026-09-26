import type { OhNetRequest } from "@/types"
import { OhNetHeader } from "@/model/header"

/** Default seed for a fresh `OhNetContext.request`; cloned by `createDefaultContext` so the module-level instance is never shared. */
export const DEFAULT_OHNET_REQUEST: OhNetRequest = {
  url: "",
  method: "GET",
  headers: new OhNetHeader(),
  responseType: "auto",
}
