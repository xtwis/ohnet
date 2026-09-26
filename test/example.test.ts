import { describe, expect, it } from "vitest"

describe("module - topic", () => {
  it("lowercase verb + object + optional condition, third person", () => {
    expect(true).toBe(true)
  })
  it("under ~60 chars, describes observable behavior, not implementation", () => {
    expect(false).toBe(false)
  })
})

describe("example - good description patterns", () => {
  it("starts with a lowercase verb and describes behavior", () => {
    expect(1 + 1).toBe(2)
  })

  it("starts with a lowercase verb even when the API starts uppercase", () => {
    // "toJSON" comes AFTER the lowercase verb, so eslint is happy.
    const obj = { toJSON: () => ({ ok: true }) }
    expect(JSON.stringify(obj)).toBe("{\"ok\":true}")
  })

  it("uses third-person present tense for the assertion", () => {
    expect("ohnet").toMatch(/^ohnet$/)
  })
})

describe("example - bad description patterns (do NOT write these)", () => {
  it("rejects uppercase-leading words like JSON.stringify or HTTP", () => {
    // BAD:  it("JSON.stringify works via auto-toJSON", ...)
    // GOOD: it("toJSON is invoked by JSON.stringify", ...)
    //
    // ESLint fails the build on uppercase-leading titles. Rephrase so a
    // lowercase word leads the sentence.
    expect(true).toBe(true)
  })

  it("rejects implementation details like super() or [code] prefix", () => {
    // BAD:  it("super() formats Error.message as [code] message", ...)
    // GOOD: it("message holds only the raw text", ...)
    expect(true).toBe(true)
  })

  it("rejects two unrelated assertions in one title", () => {
    // BAD:  it("returns X; throws Y", ...)
    // GOOD: it("returns X")  +  it("throws Y")
    expect(true).toBe(true)
  })

  it("rejects non-ASCII characters in titles (em-dash, middle dot)", () => {
    // BAD:  it("returns X - parent is not mutated", ...)
    // GOOD: it("returns X without mutating the parent")
    expect(true).toBe(true)
  })
})
