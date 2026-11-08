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
- `artifacts/api-server/src/lib/seed.ts` — transactional empty-table startup data seeding
- `lib/db/src/schema` — profiles, usage log, swipes and persistent anonymous sessions
- `lib/api-spec/openapi.yaml` — source of truth for API types

## Architecture decisions

- No accounts or login: persistent anonymous sessions identify visitors only.
- Startup seeds data, not schema. Replit Publish manages production schema changes.
- Public history intentionally includes all visitors' records for cross-browser grading; redact contact information on the server.

## Product

Phase 1 provides a sample-people preview and public history with expandable inputs/results, status and sample badges. AI matching, onboarding, swiping and connections belong to subsequent approved phases.

## User preferences

- Stop after each of the five approved phases and provide exact main-app/history URLs and testing steps.
- Use direct server-side Anthropic access in the AI phase; do not silently substitute credit-billed AI access.

## Gotchas

- History must never expose session identifiers or unredacted emails, phone numbers or URLs.
- Sample usage entries are demonstrations, not actual AI requests, and must not consume AI quota.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
