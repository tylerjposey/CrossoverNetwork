---
name: Crossover delivery constraints
description: Confirmed platform and phased delivery expectations, plus anonymous-history privacy.
---

Crossover launches as a mobile-friendly website, not a native Expo app.
**Why:** The user explicitly selected the website after the attachment and initial mobile selection conflicted.
**How to apply:** Build for public browser testing and mobile widths unless the user changes the platform.

Stop after each of the five requested build phases, explain what was built and exactly how to test it, and wait for continuation.
**Why:** The user's product brief explicitly requires phase-by-phase stops.
**How to apply:** Approval of the overall build plan is not permission to skip these review stops.

Public history must show ALL sample and real records across sessions, newest first, with a Your run badge for current-session records.
**Why:** The user says graders may inspect history from a different browser session and the assignment requires every use to be shown.
**How to apply:** Redact emails, phone numbers and URLs to "[removed]" server-side before returning input or AI output for public display. Keep originals server-side only; never expose session identifiers. Show the user's exact public-history disclosure under the onboarding text box.

Limit AI usage globally to 200 logical calls per UTC day, configurable through one constant, as well as five per visitor per rolling hour.
**Why:** The user explicitly added a database-backed global daily cap.
**How to apply:** Count deck builds and rewrites, including errors and model-declared insufficient input; count a build's parse retry only once. Pre-AI input-check rejection is free. A global block logs rate_limited and uses the friendly AI-break message, never the visitor-limit message. Phase 2 must demonstrate all specified input/injection/quota paths, restore the temporarily lowered test cap, and explain how to change the constant.
