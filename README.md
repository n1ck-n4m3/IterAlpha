# IterAlpha

IterAlpha is an open-source, browser-based trading judgment trainer. It helps people learn, make a decision before the future is visible, review their reasoning, and practise again. The current MVP starts with crypto spot simulation. It does not place real trades or promise investment performance.

The homepage at `/` introduces two paths and includes an interactive decision preview and an opt-in early-access form. The training room at `/app` contains fresh generated BTC/ETH scenarios, a synthetic market lab, a decision journal, and progress history. The Foundations path adds explanations; Advanced Practice shows facts and uncertainty first. Reasons are optional taps, not writing assignments.

## What works today

- A fresh synthetic scenario for each round, with six guided or eight advanced hidden-future decision checkpoints. Reveal intervals are 15 minutes, 1 hour, or 4 hours; users may wait at any checkpoint. The virtual starting balance defaults to $10,000.
- Spot buy, wait, hold, and sell decisions. The order preview shows USD spend, quantity, remaining cash, and estimated loss at a protective stop. Fees, slippage, fills, stops, and outcomes are calculated by the simulation engine.
- A decision-by-decision review, rule-based process feedback, a journal, and JSON export. AI coaching is optional and not enabled without server credentials.
- A synthetic market lab with charts for BTC, ETH, SOL, and XRP. Its sample values are not live or historical quotes and are separate from simulated trade execution.
- An opt-in email form stored in D1. No automated email campaign is connected.
- Optional ChatGPT account sign-in. Guests can play without an account; signing in claims this browser's guest rounds and lets the same account reopen its journal on another device.
- A private `/admin` visitor dashboard with page views, unique visitors, signed-in visitors, and early-access totals. The account owner is configured with `ITERALPHA_ADMIN_EMAIL` or `ITERALPHA_ADMIN_USER_ID`; the route and report API check this on the server.

The site records visited sections and timestamps. Signed-in visits include the account email; guest visits use a one-way anonymous identifier. IP addresses are not stored in this log. The dashboard shows the last 30 days and older entries are pruned as new visits arrive. Multiple visits by one visitor to the same section within 15 minutes count once.

Synthetic practice paths are **not historical replays**. Each checkpoint separates visible price, range, and volume calculations from teaching interpretations and unknowns. The homepage preview is illustrative and does not save a trade. The project includes a historical snapshot adapter and a dormant Coinbase integration adapter; neither supplies prices to the public test. Using real data requires suitable storage and display rights plus reviewed snapshots. No brokerage account is connected.

## Run locally

Use Node.js 22.13 or newer. This project uses a Cloudflare Worker with a local D1 database for preview.

```sh
npm ci
npm run check
npm test
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_long_multiple_man.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_bizarre_joystick.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_concerned_pete_wisdom.sql
npm run start
```

Open the local URL printed by Wrangler, usually `http://127.0.0.1:8787/`. Apply each migration only once to a given local database. Local data is separate from any deployed site's D1 database.

No AI key is required for the demo. To enable the optional coach, set `OPENAI_API_KEY` and `OPENAI_MODEL` as server-side secrets in your own runtime. See [.env.example](.env.example) and [the integration guide](docs/INTEGRATION-GUIDE.md). Never expose a key in the browser or commit it to Git.

The hosted demo uses Sites' built-in ChatGPT sign-in. This is not a standalone email/password account system. Set `ITERALPHA_ADMIN_EMAIL` to the site owner's verified sign-in email, or `ITERALPHA_ADMIN_USER_ID` to the authenticated Site user ID, in the production runtime before using `/admin`. If neither matches, the admin page stays inaccessible.

## Project layout

| Path | Purpose |
| --- | --- |
| `app/`, `components/` | Landing page, training room, market watch, and charts |
| `lib/training/` | Simulation rules, order estimates, and review calculations |
| `lib/server/` | API, generated scenes, data adapters, storage, and optional coach |
| `db/`, `drizzle/` | D1 schema and migrations |
| `tests/` | API and engine tests |
| `docs/` | Owner-facing product and integration guidance |

The runtime needs a D1 binding named `DB`. If you deploy to a new host, create your own database and configure that binding; this repository does not include a production database, visitor records, email addresses, or deployment credentials. The original demonstration site uses OpenAI Sites hosting, which is separate from a self-managed Cloudflare account.

## Scope and license

IterAlpha is a training environment for improving human judgment, not an AI trading bot. The existing feedback is rules-based until an AI service is configured. Market Lab is an explicitly synthetic visualization and never settles practice orders. Results from a few simulated rounds cannot establish trading skill or real-world profitability.

Source code is available under the [MIT License](LICENSE). Product name and visual identity are part of IterAlpha's brand; MIT covers the repository's software and included assets subject to their own notices where indicated.
