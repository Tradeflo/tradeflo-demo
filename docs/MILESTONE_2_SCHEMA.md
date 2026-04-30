# Milestone 2 — Target schema (Task 1)

**Status:** Design complete — apply via a follow-up migration task (Epic A / Task 5).

**Authority:** `docs/srs.txt` §4.2–4.4; `docs/TRADEFLO_AI_NEXTJS_DEVELOPMENT_PLAN.md` (`quote_versions` model). If this doc conflicts with the SRS, **follow the SRS**.

---

## 1. Current state (Milestone 1)

Defined in `db/quotes.sql`:

| Table            | Purpose |
|-----------------|---------|
| `quotes`        | One row per quote thread: `user_id`, **`status`** (quote-level), `title`, **`current_version`**, timestamps. |
| `quote_versions`| One row per version: `version_number`, **`payload` JSONB** (quote-builder state), timestamps. |

M1 API behavior (`PATCH /api/quotes/[id]`): edits allowed only when **`quotes.status === 'draft'`**, and payload updates target the row with `version_number = quotes.current_version`.

---

## 2. Design decisions

### 2.1 Canonical version state lives on `quote_versions`

- Add **`quote_versions.status`** with the same allowed values as today on `quotes`:  
  `draft` | `sent` | `approved` | `changes_requested`.
- **Canonical rule:** The **truth** for “what state is this version in?” is **`quote_versions.status`**, not duplicate semantics split across tables.

**Migration default:** Existing rows: set `status = 'draft'` (all M1 versions are drafts).

### 2.2 `quotes.status` — head version mirror

- **`quotes.status`** always matches **`quote_versions.status`** for the row where  
  **`quote_versions.version_number = quotes.current_version`** (the **head** version the UI/API treats as “current”).
- When the head version is **sent**, `quotes.status` is **`sent`** until a **new draft** is created (see versioning below), then the head moves to the new row and `quotes.status` becomes **`draft`** again.

This keeps **list views** and **simple guards** (`quotes.status`) working without joining every time, while preserving per-version history on `quote_versions`.

### 2.3 Snapshots — keep JSONB; no separate snapshot column for M2

- **SRS §4.3** requires a stored snapshot (line items, totals, customer, timestamp).  
- **Decision (M2):** The **`payload` JSONB** **is** the snapshot for each version. At **send**, we **freeze** it by **enforcing immutability** on that `quote_versions` row (no payload mutations on `sent`).
- **No** duplicate `snapshot jsonb` column in M2 — avoids drift between `payload` and copy.

**Later refactor:** A normalized `line_items` table (dev plan) can be a future migration; M2 stays compatible with current `src/lib/schemas/quotes.ts` / builder payload shape.

### 2.4 Send immutability (database)

- **Rule:** Rows with **`quote_versions.status = 'sent'`** must **not** allow updates that change contractor-owned content (`payload`, `version_number`, `quote_id`, or rolling back `status` / `sent_at`).
- **Enforcement:** `BEFORE UPDATE` trigger on `quote_versions` that **raises** if `OLD.status = 'sent'` and the update would alter protected columns.
- **M3 exception (documented now, implemented later):** Customer **approve** / **request-changes** flows must update `approved` / `changes_requested`, `approval_token_consumed_at`, etc. Options for M3:
  - Narrow the trigger to block only `payload` / `version_number` / `quote_id` changes when `OLD.status = 'sent'`, **or**
  - Use a **security definer** RPC for client actions, **or**
  - **Service role** path for token consumption only.

M2 only needs **`sent`** rows to be immutable from **contractor** PATCH routes; trigger + API checks together satisfy SRS until public token routes land.

### 2.5 New columns on `quote_versions`

| Column | Type | Purpose |
|--------|------|---------|
| `status` | `text` + CHECK | `draft` \| `sent` \| `approved` \| `changes_requested`. Default `draft`. |
| `sent_at` | `timestamptz` null | Set when transitioning to `sent`. |
| `approval_token` | `text` null **UNIQUE** | Opaque token for client portal (SRS §4.4). |
| `approval_token_expires_at` | `timestamptz` null | Optional TTL. |
| `approval_token_consumed_at` | `timestamptz` null | Set after single customer action (M3). |

Optional **M2+ / AI** (can land with generate work): `ai_model_used`, `ai_prompt_version`, `ai_generated_at` — align with dev plan when implementing `/api/quotes/[id]/generate` persistence.

**Indexes:** `(quote_id, status)` if list filters by version state; unique on `approval_token` where not null (partial unique index if preferred).

### 2.6 `quotes` table (M2)

- **No new columns required** for Task 1 if `status` + `current_version` stay as today.
- Update **table comment** to reflect M2: quote row = thread; version state on `quote_versions`.
- **`quotes.status`** CHECK stays aligned with version statuses.

---

## 3. Versioning rules (edit after send)

1. **While head is `draft`:** Contractor may **`PATCH`** title + **head** `payload` (same as M1, keyed by `current_version`).
2. **Send:** Transition **head** row from `draft` → **`sent`**, set **`sent_at`**, issue **`approval_token`**, set **`quotes.status` = `sent`** (mirror head).
3. **New draft after send:** **`INSERT`** new `quote_versions` row:  
   `version_number = quotes.current_version + 1`, `status = 'draft'`, **`payload`** = initial copy from last sent (or empty — product choice; recommend **copy** so contractor edits from what customer saw).  
   Then **`quotes.current_version` += 1**, **`quotes.status` = `draft`**.
4. **Never** delete or in-place mutate a **`sent`** version’s `payload` / `version_number`.

---

## 4. RLS and security notes

- **Existing policies** (owner can `select`/`insert`/`update` own `quote_versions`) remain for **authenticated** users.
- **M3:** **`SELECT` by `approval_token`** for unauthenticated client portal will need either:
  - a **public** RPC that returns limited fields, or
  - RLS policy allowing read where token matches (narrow column exposure), plus **no** broad public table access.
- **`approval_token`** must be **unguessable** (e.g. 32+ bytes random, stored hashed — **hash-at-rest** is optional in M2 if SRS requires server-side storage only; dev plan stores token on row — document threat model in M3).

---

## 5. Deliverables checklist (Task 1)

| Artifact | Status |
|----------|--------|
| Schema sketch / column list | This document §2.5–2.6 |
| Versioning rules | §3 |
| Snapshot rule | §2.3 (payload = snapshot; frozen by immutability) |
| RLS / token impact | §4 |

**Applied schema:** `db/quotes_m2.sql` (run on Supabase after `db/quotes.sql`).  
**Task 2 (version lifecycle):** `PATCH /api/quotes/[id]` creates a **new** `quote_versions` row when the head version is **not** `draft` and the client sends `payload`; immutability trigger blocks in-place `payload` changes on non-draft rows.  
**Next:** Send flow, tokens, sync `quotes.status` on send, onboarding/AI (remaining M2 epics).
