# Browser Action

Drives the running app with the Playwright MCP tools and checks the current
feature against its goals. Only run this when it is asked for — the other
actions stop at a green build and leave the browser alone.

1. Read current-feature.md — the Goals are the checklist, one browser check each
2. Get a dev server up on http://localhost:3000:
   - Check the port first. A second `npm run dev` in this directory exits 1 and
     points at the running PID — reuse that server, don't fight it
   - If `npm run build` has run since, delete `.next` before starting dev. They
     share the directory and a dev server on build output produces phantom
     errors (a bogus `useSidebar must be used within SidebarProvider`, a "Jest
     worker encountered 2 child process exceptions" 500)
   - Never `npm run build` while a dev server is live
   - Never use `next start` as a scratch server — production mode loads
     `.env.production`, which points at the **production** Neon branch
3. Sign in as `demo@devstash.io` / `12345678` — the seeded account is the only
   one with content (18 items, 5 collections)
4. Walk the goals. Prefer reading the DOM over reading a screenshot when the
   claim is measurable — `getComputedStyle`, `scrollWidth === innerWidth` for
   overflow, a network response body — and screenshot for layout and colour
5. Check the console for errors and hydration warnings before finishing
6. Check the narrow viewport (390px) for horizontal overflow
7. Report **per goal**: verified, failed, or not verifiable — and for the last
   one say why. Never present a check you didn't run as passing

## Rules

- **Do not add temporary instrumentation to source files** to reach a UI state
  (artificial delays, forced error responses, negated TTLs). To exercise a slow
  or failing response, intercept it in the browser with `page.route()` through
  `browser_run_code_unsafe`, which leaves the repo untouched
- **Never attach a Playwright event listener** (`page.on('request')`,
  `page.on('response')`, …) inside `browser_run_code_unsafe`. It outlives the
  snippet and closes the MCP connection — the browser resets to `about:blank`
  and the signed-in session is gone. To see what the page requested, wrap
  `window.fetch` through `page.evaluate` instead and read the log back out:

  ```js
  await page.evaluate(() => {
    window.__calls = [];
    const orig = window.fetch;
    window.fetch = async (...args) => {
      const entry = { url: String(args[0]), status: "pending" };
      window.__calls.push(entry);
      try {
        const res = await orig(...args);
        entry.status = res.status;
        return res;
      } catch (e) {
        entry.status = "threw: " + e.message;
        throw e;
      }
    };
  });
  // … drive the UI, then:
  await page.evaluate(() => window.__calls);
  ```

  It lives in the page, so a navigation clears it — re-install after each one.
  `page.route()` is still the way to *change* a response; this is only for
  watching. Note `route.fetch()` inside a handler that also calls
  `route.fulfill()` raises "Route is already handled!" — build a fixed body
  instead of relaying the real one
- **Timing reads need timing discipline.** A generous `waitForTimeout` after an
  action will step past a transient state and read it as absent — a toast that
  has auto-dismissed and a 2s confirmation that has reverted both look like
  nothing happened. Poll for the state with a short interval rather than
  sleeping through it
- **Stripe checkout is an off-origin page.** Clicking Upgrade leaves the app for
  `checkout.stripe.com`, so the run continues on Stripe's own DOM and comes back
  to `/settings?checkout=…`. Nothing there is ours to assert on beyond the
  amount and the plan name. Test cards, all with **any** future expiry, **any**
  3-digit CVC and **any** 5-digit ZIP:

  | Card | Outcome |
  |---|---|
  | `4242 4242 4242 4242` | Visa, payment succeeds |
  | `4000 0000 0000 0002` | Generic decline |

  The declined card is the more interesting check: it must leave the account
  free — no entitling webhook, `isPro` still false — rather than half-upgrading
  it. Use a throwaway account, never `demo@devstash.io`, and never a real card.

  `isPro` is only ever written by the webhook, so **no checkout proves anything
  unless `stripe listen --forward-to localhost:3000/api/webhooks/stripe` is
  running** and its `whsec_…` is the one in `.env`. Without it the handler
  refuses every delivery by design, and the settings page will sit on Free
  looking like a bug in the card
- Read-only against the database. Anything the app itself wouldn't write needs
  asking first — a state that only exists with data the seed doesn't create is
  a "not verifiable", not a reason to run SQL
- Delete screenshots and any other artifacts when the pass is over
- Leave the dev server running so the result can be looked at
