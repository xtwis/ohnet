/**
 * Base class for every error produced or wrapped by the library.
 *
 * @remarks
 * Carries five fields for downstream matching: `type` for coarse
 * classification (`"OHNET_INTERNAL"` vs `"OHNET_UNKNOWN"`), `code`
 * for the specific failure mode, `message` for the human-readable
 * text, and `data` / `error` for an optional structured payload and
 * the original cause. Downstream code should branch on `code` rather
 * than match `Error.message`.
 */
export class OhNetError extends Error {
  /** Coarse classification. Subclasses pick a stable value (e.g. `OHNET_ERROR_TYPE`). */
  type: string
  /** Specific failure mode. Internal subclasses use one of `OHNET_ERROR_CODE` values. */
  code: string
  /**
   * Human-readable description, with no `type` or `code` prefix.
   *
   * @remarks
   * Differs from `Error.message`, which carries `` `[${code}] ${message}` ``
   * for stack-trace readability. Branch on `code` rather than matching
   * `Error.message`.
   */
  message: string
  /** Optional structured payload attached to the error. ohnet never inspects it. */
  data?: unknown
  /** Optional underlying cause preserved on the instance for logging. */
  error?: unknown

  /**
   * @param type - Coarse classification; subclasses pick a stable value.
   * @param code - Specific failure mode; subclasses use one of `OHNET_ERROR_CODE`.
   * @param message - Human-readable description with no prefix. Stored
   *   verbatim on `this.message` and embedded in `Error.message` as
   *   `` `[${code}] ${message}` ``.
   * @param data - Optional structured payload stored on `this.data`.
   * @param error - Optional underlying cause stored on `this.error`.
   */
  constructor(type: string, code: string, message: string, data?: unknown, error?: unknown) {
    super(`[${code}] ${message}`)
    this.type = type
    this.code = code
    this.message = message
    this.data = data
    this.error = error
  }
}
