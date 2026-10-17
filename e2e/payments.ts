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

// PayPal (taak 13b): nep-PayPal en een derde app-server die met PayPal betaalt
export const PAYPAL_MOCK_PORT = 3103;
export const PAYPAL_APP_PORT = 3104;
export const PAYPAL_APP_URL = `http://localhost:${PAYPAL_APP_PORT}`;
export const MOCK_PAYPAL_CLIENT_ID = "e2e-client";
export const MOCK_PAYPAL_CLIENT_SECRET = "e2e-secret";
export const MOCK_PAYPAL_PAYER = "P. PayPal";
// QR-code van de nep-PayPal: een PNG van 1x1 pixel (als base64-tekst, zoals PayPal die stuurt)
export const MOCK_PAYPAL_QR =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
