import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["modules/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    environmentMatchGlobs: [
      ["modules/platform/**/*.test.ts", "node"],
      ["modules/auth/**/*.test.ts", "node"],
      ["modules/sizing/**/*.test.ts", "node"],
      ["modules/orders/**/*.test.ts", "node"],
      ["modules/payments/**/*.test.ts", "node"],
      ["modules/ai/**/*.test.ts", "node"],
      ["modules/customers/**/*.test.ts", "node"],
      ["modules/content/**/*.test.ts", "node"],
      ["modules/discounts/**/*.test.ts", "node"],
      ["modules/finance/**/*.test.ts", "node"],
      ["modules/admin/**/*.test.ts", "node"],
      ["modules/money/**/*.test.ts", "node"],
    ],
    coverage: {
      include: [
        "modules/sizing/engine/resolve-chart.ts",
        "modules/sizing/engine/edit-base-cell.ts",
        "modules/sizing/engine/calculate-cut-spec.ts",
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@aks/db": path.resolve(__dirname, "packages/db/index.ts"),
      "@aks/shared": path.resolve(__dirname, "packages/shared/index.ts"),
    },
  },
});
