import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import boundaries from "eslint-plugin-boundaries";
import eslintConfigPrettier from "eslint-config-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/** @type {import("eslint").Linter.Config[]} */
const config = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "reference/**",
      "Prompt/**",
      "out/**",
      "coverage/**",
      "next-env.d.ts",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: {
      boundaries,
    },
    settings: {
      "boundaries/legacy-warnings": false,
      "boundaries/include": [
        "app/**/*",
        "modules/**/*",
        "packages/**/*",
        "worker/**/*",
        "components/**/*",
        "lib/**/*",
      ],
      "boundaries/elements": [
        // Folder-based architectural units (element patterns match folders)
        { type: "app", pattern: "app/*", capture: ["segment"] },
        { type: "modules", pattern: "modules/*", capture: ["module"] },
        { type: "db", pattern: "packages/db/**/*", capture: ["path"] },
        { type: "shared", pattern: "packages/shared/**/*", capture: ["path"] },
        { type: "worker", pattern: "worker/*" },
        { type: "components", pattern: "components/*", capture: ["group"] },
        { type: "lib", pattern: "lib/*" },
      ],
      "boundaries/files": [
        // Root-level files that sit beside route-group folders
        { pattern: "app/*.{ts,tsx}", category: "app-root" },
        { pattern: "lib/*.{ts,tsx}", category: "lib-root" },
        { pattern: "worker/*.{ts,tsx,js,mjs}", category: "worker-root" },
        { pattern: "packages/db/*.{ts,tsx,js,mjs}", category: "db-root" },
        {
          pattern: "packages/shared/*.{ts,tsx,js,mjs}",
          category: "shared-root",
        },
        { pattern: "modules/*.{ts,tsx}", category: "modules-root" },
        { pattern: "**/*.{css,scss}", category: "style" },
      ],
    },
    rules: {
      "boundaries/no-unknown-files": "error",
      "boundaries/no-unknown-dependencies": "error",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            {
              from: [
                { element: { type: "app" } },
                { file: { categories: "app-root" } },
              ],
              allow: [
                {
                  to: {
                    element: {
                      types: {
                        anyOf: [
                          "modules",
                          "shared",
                          "db",
                          "components",
                          "lib",
                        ],
                      },
                    },
                  },
                },
                { to: { file: { categories: "lib-root" } } },
                { to: { file: { categories: "style" } } },
              ],
            },
            {
              from: [
                { element: { type: "modules" } },
                { file: { categories: "modules-root" } },
              ],
              allow: [
                {
                  to: {
                    element: {
                      types: {
                        anyOf: [
                          "modules",
                          "shared",
                          "db",
                          "components",
                          "lib",
                        ],
                      },
                    },
                  },
                },
                { to: { file: { categories: "lib-root" } } },
                { to: { file: { categories: "db-root" } } },
                { to: { file: { categories: "shared-root" } } },
              ],
            },
            {
              from: { element: { type: "components" } },
              allow: [
                {
                  to: {
                    element: {
                      types: {
                        anyOf: ["components", "shared", "lib", "modules"],
                      },
                    },
                  },
                },
                { to: { file: { categories: "lib-root" } } },
              ],
            },
            {
              from: [
                { element: { type: "lib" } },
                { file: { categories: "lib-root" } },
              ],
              allow: [
                {
                  to: {
                    element: { types: { anyOf: ["lib", "shared"] } },
                  },
                },
                { to: { file: { categories: "lib-root" } } },
              ],
            },
            {
              from: { element: { type: "db" } },
              allow: [
                {
                  to: {
                    element: { types: { anyOf: ["db", "shared"] } },
                  },
                },
                { to: { file: { categories: "db-root" } } },
                { to: { file: { categories: "shared-root" } } },
              ],
            },
            {
              from: { file: { categories: "db-root" } },
              allow: [
                {
                  to: {
                    element: { types: { anyOf: ["db", "shared"] } },
                  },
                },
                { to: { file: { categories: "db-root" } } },
                { to: { file: { categories: "shared-root" } } },
              ],
            },
            {
              from: { element: { type: "shared" } },
              allow: [
                { to: { element: { type: "shared" } } },
                { to: { file: { categories: "shared-root" } } },
              ],
            },
            {
              from: { file: { categories: "shared-root" } },
              allow: [
                { to: { element: { type: "shared" } } },
                { to: { file: { categories: "shared-root" } } },
              ],
            },
            {
              from: { element: { type: "worker" } },
              allow: {
                to: {
                  element: {
                    types: { anyOf: ["worker", "modules", "shared", "db"] },
                  },
                },
              },
            },
            {
              from: { file: { categories: "worker-root" } },
              allow: [
                {
                  to: {
                    element: {
                      types: { anyOf: ["worker", "modules", "shared", "db"] },
                    },
                  },
                },
                { to: { file: { categories: "db-root" } } },
                { to: { file: { categories: "shared-root" } } },
              ],
            },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
];

export default config;
