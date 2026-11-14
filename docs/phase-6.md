# Phase 6 — Richer demo and simulated replies

## What changed

- **Roster:** 60 fictional sample profiles across 50 schools and 49 majors, with no contact details. The original 30 rows are unchanged.
- **Existing databases:** `seedIfEmpty()` now tops up profiles on every start. Under the existing seed advisory lock it inserts only rows whose first name + school + major are missing. Existing rows, their IDs, swipes and snapshots are never modified. Sample usage records are still seeded only into an empty table. There is no schema change and no runtime DDL. If an operator edits a sample row's name, school or major by hand, the original row will be re-added on the next start.
- **Deck filters (no AI):** All, Other schools, Other majors, Shared interests, Similar goals (keyword overlap on career goals).
  - Stored per deck in session data via `POST /api/crossover/deck/filter`, and enforced by swipe validation.
  - Progress counts the filtered cards.
  - Undo resets to All when the restored card would be hidden.
  - A new deck starts on All.
  - A chip is disabled when the visitor card lacks the fact it compares, or when no cards are left.
- **Next step (no AI):** every connection carries a `next_step` derived from saved match data:
  - Super Connects get a coffee-chat ask.
  - A shared interest becomes the opener.
  - Otherwise the visitor is prompted to ask about the person's "Ask me about" topic.
  - Shown on the celebration screen and on Connections.
- **Simulated reply (one AI feature):** `POST /api/crossover/connections/{id}/reply`.
  - **Input:** the server builds `reply_context` from the fictional profile and the visitor's saved icebreaker. Visitor text is wrapped as untrusted data.
  - **Output:** strict JSON `{"reply"}`, 1–280 characters, max 300 output tokens.
  - **Contact details:** emails, phones, URLs and handles are rejected, with one retry inside the same reservation.
  - **Storage:** saved on the swipe snapshot, so it survives reload and disappears with Undo. A late reply cannot resurrect an undone connection.
  - **Labeling:** always shown as "Simulated reply · AI-written from a fictional sample profile, not a real person".
- **Quota decision:** replies share the existing 5/hour visitor and 200/day global reservations (`kind = 'reply'`).
  - This keeps the per-visitor and global worst-case AI spend exactly as documented in Phase 5, through the same advisory-lock reservation.
  - Asking again for an existing reply returns it with no AI call and no quota.
  - Only "Try another reply" or "Reply to my new draft" spends a call.
  - Failures use the existing friendly message and keep the saved reply and draft.
- **History:** each attempt is logged as `Simulated sample reply for profile N` with `{kind, profile_id, reply}`, redacted by the existing public redactor. The visitor's icebreaker is not logged.
- **Fix:** the swipe animation now waits for both axes before the next card loads. Previously a fast API response could leave the next card stranded off-screen after a right swipe.

## Verification (development, fixture providers only)

- `pnpm run typecheck` passes.
- Test phases 2–6 pass. `test:phase5` now uses its own profile ID sequence so isolated seeding no longer advances the shared one.
- The real seeder grew a local database seeded with the original 30 profiles to 60. A second start added nothing.
- Browser check at 375×812 with no horizontal overflow and no page errors covered:
  - filters, reload persistence and undo of a hidden card;
  - next steps on the celebration screen and on Connections;
  - the reply failure path (no key configured), which showed the friendly message, used one slot and kept the draft;
  - a saved reply rendering, surviving reload, and being marked stale after a draft edit;
  - free reuse through the HTTP endpoint;
  - refusal of another session's ID.
- A successful real Anthropic reply was **not** exercised in this environment (no key, and no paid calls). Do one real reply after publishing.

```sh
pnpm run typecheck
pnpm --filter @workspace/api-server run test:phase6
```
