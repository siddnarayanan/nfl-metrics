import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    hookTimeout: 20000,
    testTimeout: 20000,
    setupFiles: ["./src/__tests__/setup.ts"],
  },
});
