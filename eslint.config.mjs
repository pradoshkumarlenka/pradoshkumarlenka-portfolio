import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Allow intentionally-discarded variables named with a leading underscore.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Content must go through src/lib/content (server: getContent, client: useUi/…),
    // so a future database source reaches every component. Only the registry reads JSON.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/content/registry.ts", "src/content/generated/projects.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["**/content/*.json", "**/content/projects/*.json"], message: "Read content through src/lib/content (getContent / useUi), not the JSON files." },
            { group: ["@/content/generated/*"], message: "Read projects through getProjects() in src/lib/content/server." },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "design-reference/**", "public/vendor/**"]),
]);
