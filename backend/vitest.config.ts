import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: { DB_PATH: ":memory:", NODE_ENV: "test", TZ_OFFSET_MIN: "420" },
    testTimeout: 20000,
    pool: "forks",
  },
});
