/**
 * @description Base class for every error produced or wrapped by the library. Carries `type` (coarse), `code` (specific), `message`, and optional `data` / `error`.
 * @see https://x.twis.uk/en/ohnet/reference/errors.html#ohneterror
 */
export class OhNetError extends Error {
  /** Coarse classification. Subclasses pick a stable value (e.g. `OHNET_ERROR_TYPE`). */
  type: string
  /** Specific failure mode. Internal subclasses use one of `OHNET_ERROR_CODE` values. */
  code: string
  /** Human-readable description, with no `type` or `code` prefix. Differs from `Error.message`, which carries `[${code}] ${message}`. Branch on `code`. */
  message: string
  /** Optional structured payload attached to the error. ohnet never inspects it. */
  data?: unknown
  /** Optional underlying cause preserved on the instance for logging. */
  error?: unknown

  constructor(type: string, code: string, message: string, data?: unknown, error?: unknown) {
    super(`[${code}] ${message}`)
    this.type = type
    this.code = code
    this.message = message
    this.data = data
    this.error = error
  }
}
