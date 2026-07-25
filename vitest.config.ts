import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["modules/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "@aks/db": path.resolve(__dirname, "packages/db/index.ts"),
      "@aks/shared": path.resolve(__dirname, "packages/shared/index.ts"),
    },
  },
});
