import antfu from "@antfu/eslint-config"

export default antfu({
  type: "lib",
  typescript: true,
  stylistic: {
    quotes: "double",
  },
  formatters: {
    markdown: true,
  },
}, {
  files: ["**/*.md"],
  rules: {
    "markdown/no-missing-link-fragments": "off",
  },
})
