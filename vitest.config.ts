import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  // `server-only` throws outside the React server condition; tests run server code directly.
  "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
};

export default defineConfig({
  test: {
    projects: [
      { resolve: { alias }, test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" } },
      {
        resolve: { alias },
        test: { name: "integration", include: ["tests/integration/**/*.test.ts"], environment: "node", setupFiles: ["tests/support/integration-env.ts"], fileParallelism: false, testTimeout: 30_000 },
      },
    ],
  },
});
