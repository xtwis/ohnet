import type { TestServer } from "../server"
import { OhNetBuilder } from "@xtwis/ohnet"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { createTestServer } from "../server"

describe("e2e - basic", () => {
  let server: TestServer
  let request: OhNetBuilder

  beforeAll(async () => {
    server = await createTestServer()
    request = new OhNetBuilder({ url: server.url })
  })

  beforeEach(() => {
    server.reset()
  })

  afterAll(async () => {
    await server.close()
  })

  it("sends a GET and reads the response body", async () => {
    server.reply("GET", "/hello", "world")

    const data = await request.get<string>("/hello")

    expect(data).toBe("world")
    expect(server.count("GET", "/hello")).toBe(1)
  })
})
