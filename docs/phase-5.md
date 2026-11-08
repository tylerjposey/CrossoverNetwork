# Phase 5 — Launch checks

## Pre-publication results

- Frontend production build and API production build pass; workspace TypeScript checks pass.
- Compiled browser assets contain no Anthropic credential name, secret name, key prefix, or Anthropic API endpoint. The SDK and credential access remain server-only.
- Required `ANTHROPIC_API_KEY` and `SESSION_SECRET` exist for the production environment. Only existence metadata was inspected.
- The actual startup seeder was run in concurrent, independent Node processes against isolated empty tables. It creates 30 fictional profiles at 20+ schools and 10 labeled sample records, without duplicates on another start.
- The official Anthropic SDK received a simulated HTTP 401 from an isolated test transport. It produced the exact friendly error, retained the input, logged an error, spent one quota slot and made no external AI request. The real key was not read or replaced.
- Eight independent Node processes competed for the same visitor's PostgreSQL quota: exactly five reservations succeeded and three were blocked. A fresh store instance read the exhausted quota correctly.
- All Phase 2–4 database regressions passed: free invalid input, charged model-declared insufficient input, shared visitor/global quotas, one counted repair retry, UTC boundaries, timeout, private session ownership, saved profile edits, swipes, undo, and older-deck draft rewrites.
- Public-history redaction tests cover nested strings, JSON keys, numeric phones, emails and URLs.
- Local streak tests cover repeated opens, consecutive days, daylight saving, gaps, corrupt values and unavailable/full storage.
- The final browser journey passed at 375×812 with one real Build and one real Rewrite: short-input rejection was free, parsed-profile edits saved, a typed icebreaker survived navigation/reload, the rewrite persisted with three remaining AI calls, and undo restored the card/Super and removed the connection. There was no horizontal overflow or visible raw error. Clipboard interaction and intermediate loading frames were not exercised by that browser pass.
- A live API workflow restart preserved an existing signed cookie's complete profile, deck, progress and quota state. Public History also remained accessible from a different anonymous session.

These are development/pre-publication checks, not claims about a live deployment.

## Reproduce

```sh
pnpm run typecheck
pnpm --filter @workspace/api-server run test:phase2
pnpm --filter @workspace/api-server run test:phase3
pnpm --filter @workspace/api-server run test:phase4
pnpm --filter @workspace/api-server run test:phase5
TZ=America/Los_Angeles node artifacts/crossover/tests/streak.ts
pnpm --filter @workspace/api-server run build
PORT=22401 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/crossover run build
```

The database tests use temporary schemas and fixture providers. They do not delete live records or modify the real key. The final browser journey separately exercises a real build and rewrite.

## Publication

No published deployment existed when deployment metadata was checked. Publishing remains a user action. The API has a production start command and `/api/healthz` startup check; the website has a static production build and SPA deep-link rewrite. Schema changes are reviewed/applied through Publish, not runtime DDL.

After publication, obtain the actual domain using deployment tooling, verify the live build, and give the exact main, `/connections` and `/history` URLs. Do not replace the development domain by guessing a production hostname.

The global cap remains **200 logical AI calls per UTC day**. Change `GLOBAL_DAILY_AI_CAP` in `artifacts/api-server/src/lib/matchmaking/config.ts`, rebuild and republish to change it.

## Five-step post-publication checklist

1. Open the published app in an incognito window. Open `/history` too: public sample/real runs should be visible without exposing session IDs or contact details.
2. Open it on a phone with Wi-Fi turned off. Swipe, reload, and verify your progress and saved Connections remain.
3. Build using a profile unlike the samples. Check the parsed profile and ten cards; save a manual icebreaker edit and reload Connections.
4. In a separate fresh incognito session, submit gibberish. Expect the kind input message and an unchanged `5 of 5` quota.
5. In your first session, use five total Builds/Rewrites. Return to the Build screen: further calls must be blocked with “You have reached the limit for this hour, try again later”. The sixth-call server rejection is also covered by the automated quota checks.
