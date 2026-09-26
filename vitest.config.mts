import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.test.ts"],
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@xtwis/ohnet": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
    },
  },
})
