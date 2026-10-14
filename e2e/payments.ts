// Instellingen voor de betaaltests (taak 10), gedeeld door playwright.config.ts,
// de nep-Mollie (mollie-mock.ts) en betalen.spec.ts.
export const MOLLIE_MOCK_PORT = 3101;
export const PAID_APP_PORT = 3102; // tweede app-server, met betalen aan
export const MOCK_API_KEY = "test_e2e";
export const MOCK_CONSUMER_NAME = "T. TEST";
export const MOCK_CONSUMER_ACCOUNT = "NL53INGB0654422370"; // test-IBAN van Mollie
// Nep-sleutel voor PAYMENT_ENCRYPTION_KEY (32 nul-bytes), alleen voor de tests
export const MOCK_ENCRYPTION_KEY = Buffer.alloc(32).toString("base64");
export const PAID_APP_URL = `http://localhost:${PAID_APP_PORT}`;
