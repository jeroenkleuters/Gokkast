import { defineConfig } from "vitest/config";

// Unit-tests voor de spellogica en instellingen (src/lib). Geen browser nodig;
// de visuele tests komen met Playwright (taak 4).
export default defineConfig({
  resolve: { tsconfigPaths: true }, // @/... zoals in tsconfig.json
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
