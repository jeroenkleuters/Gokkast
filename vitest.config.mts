import { defineConfig } from "vitest/config";

// Unit-tests voor de spellogica en instellingen (src/lib). Geen browser nodig;
// de visuele tests staan in e2e/ en draaien met Playwright (npm run test:e2e).
export default defineConfig({
  resolve: { tsconfigPaths: true }, // @/... zoals in tsconfig.json
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
