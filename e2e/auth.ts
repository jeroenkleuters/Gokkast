import type { BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";

// Inloggen zonder Google: een sessiecookie zoals Auth.js die na het inloggen zet,
// versleuteld met de nep-sleutel van de testserver (zie playwright.config.ts).
export const TEST_AUTH_SECRET = "playwright-test-secret-niet-voor-productie";
export const TEST_ADMIN = "beheerder@example.test";

const COOKIE = "authjs.session-token"; // over http; via https heet hij __Secure-authjs.session-token

export async function loginAs(context: BrowserContext, email: string, name = "Test Beheerder") {
  const value = await encode({ token: { email, name, sub: email }, secret: TEST_AUTH_SECRET, salt: COOKIE });
  await context.addCookies([{ name: COOKIE, value, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
}
