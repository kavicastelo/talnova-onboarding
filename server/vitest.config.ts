import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 90000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
});
