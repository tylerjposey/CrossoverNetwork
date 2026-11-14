# Crossover

Crossover is a mobile-first career networking website with fictional sample people and a public, contact-redacted usage history.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/crossover run dev` — run the Crossover frontend through its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `SESSION_SECRET` — signs anonymous visitor cookies; never expose it to clients
- Required env for AI: `ANTHROPIC_API_KEY` — direct official Anthropic SDK, server only
- `pnpm --filter @workspace/api-server run test:phase2` — isolated PostgreSQL and fixture-provider tests; no paid AI calls
- `pnpm --filter @workspace/api-server run test:phase3` — isolated profile/deck/swipe/undo persistence checks; no paid AI calls
- `pnpm --filter @workspace/api-server run test:phase4` — isolated connection/draft/undo/rewrite checks; no paid AI calls
- `pnpm --filter @workspace/api-server run test:phase5` — actual empty-table seeding, simulated SDK 401, multi-process quotas and redaction; no paid AI calls
- `pnpm --filter @workspace/api-server run test:phase6` — roster top-up on an already-seeded DB, deck filters, next steps and simulated replies; fixture providers only
- `TZ=America/Los_Angeles node artifacts/crossover/tests/streak.ts` — defensive local streak and daylight-saving checks

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/crossover` — web frontend, mounted at `/`; public history at `/history`
- `artifacts/api-server/src/routes/crossover.ts` — sample profiles and public history API
- `artifacts/api-server/src/lib/seed.ts` — transactional startup seeding: idempotent profile top-up every start, sample usage records only on an empty table
- `artifacts/api-server/src/lib/deck-filter.ts` — AI-free deck filters; `next-step.ts` — deterministic connection next steps
- `lib/db/src/schema` — profiles, usage log, swipes and persistent anonymous sessions
- `lib/api-spec/openapi.yaml` — source of truth for API types
- `artifacts/api-server/src/lib/matchmaking/config.ts` — single global daily cap constant (200), model and time/token budgets
- `artifacts/api-server/src/lib/matchmaking` — provider, prompt, schema checks and atomic quota reservations
- `artifacts/api-server/src/lib/deck-store.ts` — authoritative deck order, profile edits, swipe progress and undo
- `artifacts/api-server/src/lib/connection-store.ts` — session-wide connections and saved drafts, including earlier decks

## Architecture decisions

- No accounts or login: persistent anonymous sessions identify visitors only.
- Startup seeds data, not schema. Replit Publish manages production schema changes.
- Public history intentionally includes all visitors' records for cross-browser grading; redact contact information on the server.
- AI reservations are persisted independently of usage logs. They count logical attempts, including failures and model-declared insufficient input; seeded logs and pre-AI rejections never consume quota.
- Both quotas are reserved in one database transaction under a short global advisory lock; provider calls run outside the lock.
- Profile seeding is a top-up keyed by first name + school + major under the seed advisory lock, so a previously seeded database gains new roster rows without duplicates and existing IDs never change. No runtime DDL.
- Deck filters are stored per deck in session JSON and enforced by swipe validation. Undo resets the filter to All when the restored card would be hidden.
- Simulated replies share the 5/hour visitor and 200/day global quotas (`ai_requests.kind = 'reply'`). They are stored on the connection's swipe snapshot. Asking again returns the saved reply free; only Regenerate spends a call. Replies that contain contact details are rejected and retried once within the same reservation.
- Swipes are scoped to deck and anonymous session; session-row locking and a uniqueness constraint prevent duplicate actions. Undo checks the expected latest swipe.

## Product

Phases 1–4 provide fictional profiles, public redacted history, AI endpoints, onboarding, editable parsed cards, persistent swipes and undo, connection celebrations, session-wide Connections, saved/copyable/rewritable drafts, a real deck summary and a defensive local opening streak. Phase 6 adds a 60-person roster, AI-free deck filters and next-step suggestions, and labeled simulated replies from sample people (see `docs/phase-6.md`). The main routes are `/`, `/connections` and `/history`. Phase 5 pre-publication checks and the five-step post-publication checklist are in `docs/phase-5.md`; live-deployment verification requires the user to publish first.

## User preferences

- Stop after each of the five approved phases and provide exact main-app/history URLs and testing steps.
- Use direct server-side Anthropic access in the AI phase; do not silently substitute credit-billed AI access.

## Gotchas

- History must never expose session identifiers or unredacted emails, phone numbers or URLs.
- Sample usage entries are demonstrations, not actual AI requests, and must not consume AI quota.
- Simulated replies must always be labeled as AI-written from fictional sample profiles, never presented as real people.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
