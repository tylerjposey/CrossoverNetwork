---
name: Node and tsx subprocess probes
description: A Node 24 loader-worker constraint affecting isolated startup tests.
---

Avoid `--input-type=module` when spawning Node 24 probes with the tsx loader; use a file or an async wrapper with dynamic imports instead.

**Why:** The flag can reach tsx's file-based loader worker and fail with `ERR_INPUT_TYPE_NOT_ALLOWED`, even though the parent command uses `--eval`. This is a loader startup failure, not an application/database fault.

**How to apply:** When extending isolated multi-process launch checks, keep module mode out of inherited Node loader-worker flags.
