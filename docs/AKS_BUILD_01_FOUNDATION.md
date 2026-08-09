# AKS BUILD — 01: FOUNDATION
### Steps 1–12 · repo, database, tokens, auth, RBAC, admin shell

> One step per Cursor chat. Verify each exit criterion yourself before moving on.
> Prerequisite: `.cursorrules` from file 00 exists at repo root.

---

## STEP 1 — Repo skeleton & tooling

**Goal:** a Next.js app with strict TypeScript, Tailwind v4, shadcn/ui, and CI that fails on type errors.

**Prompt:**
> Create a new Next.js 15 project with App Router, TypeScript and Tailwind v4. Enable strict mode plus `noUncheckedIndexedAccess` in tsconfig. Initialise shadcn/ui. Add ESLint and Prettier. Create this folder structure and enforce it with an eslint boundaries rule: `/app/(shop)`, `/app/(admin)`, `/app/api`, `/modules`, `/packages/db`, `/packages/shared`, `/worker`, `/docs`. Add a GitHub Actions workflow running typecheck, lint and build on push. Do not add any features.

**Exit:** `npm run dev` serves a blank page. `npm run typecheck` passes. CI is green.

---

## STEP 2 — Reference repo & docs

**Goal:** Cursor has patterns to copy and specs to read.

**Prompt:**
> Create a `/reference` folder and add it to `.gitignore`. Clone `https://github.com/Kiranism/next-shadcn-dashboard-starter` into it. Create `/docs` and confirm the AKS spec markdown files are present there. Then read the reference repo's structure and write `/docs/REFERENCE_NOTES.md` summarising: how it structures a data table, how it structures a form with validation, how its sidebar layout is composed, and how its kanban board is built. Do not copy any code yet.

Place these files in `/docs` yourself before running the prompt:
`AKS_Design_And_Sizing_Unified.md` · `AKS_Admin_Portal_Prompt.md` · `AKS_Brand_Foundation.md` · `AKS_Tier1_RealShop_Prompt.md` · `AKS_Tier2_Production_Prompt.md`

**Exit:** `/docs/REFERENCE_NOTES.md` accurately describes four patterns you can read and understand.

---

## STEP 3 — Database connection & migrations

**Goal:** Drizzle talking to Postgres with a repeatable migration workflow.

**Prompt:**
> Set up Drizzle ORM with PostgreSQL in `/packages/db`. Configure drizzle-kit for migrations. Add npm scripts: `db:generate`, `db:migrate`, `db:studio`, `db:seed`. Use `DATABASE_URL` from env. Create `.env.example` documenting every variable. Add a UUIDv7 helper in `/packages/shared` — generate IDs in application code, do not rely on a database function. Create one trivial table to prove the pipeline works, then a migration for it.

Create a Neon (or Supabase) Postgres project first and put its URL in `.env.local`.

**Exit:** `npm run db:migrate` runs clean; the test table appears in `db:studio`.

---

## STEP 4 — Core schema: identity & platform

**Goal:** the tables every later step depends on.

**Prompt:**
> Create the Drizzle schema for: `users` (id, email unique, name, phone, role, status, emailVerifiedAt, twoFactorSecret encrypted, twoFactorEnabledAt, lastLoginAt, deletedAt), `sessions`, `accounts`, `verification_tokens`, `permissions`, `role_permissions`, `user_permissions`, `staff_invites`, `audit_logs` (actorId, actorRole, action, entityType, entityId, before jsonb, after jsonb, ip, userAgent, createdAt), `outbox` (topic, payload jsonb, status, attempts, lastError, availableAt, sentAt), `assets` (r2Key, mime, width, height, bytes, sha256, kind, uploadedById, isAiGenerated default false, purgeAt, purgedAt). All with UUIDv7 PKs and createdAt/updatedAt. `audit_logs` is append-only — no update or delete paths. Generate and run the migration.

**Exit:** all tables exist. Attempting to update an `audit_logs` row is not possible through any exposed code path.

---

## STEP 5 — Design tokens & fonts

**Goal:** the visual foundation, so no later step invents a colour.

**Prompt:**
> Configure the Tailwind v4 `@theme` block with exactly these tokens and no others: `--color-greige #DCD9CF`, `--color-greige-deep #C9C5B9`, `--color-ink #16181D`, `--color-indigo #1B2547`, `--color-indigo-lift #2A3760`, `--color-chalk #8FA6B2`, `--color-zari #B08D4C`, `--color-madder #8C2F39`. Set border radius to 2px globally and disable box shadows. Self-host three fonts with `next/font/local`: a high-contrast display serif, a neutral variable grotesk for UI, and Martian Mono for all numeric data. Also add Noto Naskh Arabic for Urdu UI text. Create `/app/(admin)/tokens/page.tsx` rendering every colour swatch and every type size.

**Fonts — download these yourself into `/public/fonts` or `/app/fonts` before running:**
- Display: **Melodrama** or **Fraunces** — Melodrama from fontshare.com (free for commercial use); Fraunces from Google Fonts if Melodrama is unavailable
- UI: **Switzer** from fontshare.com, or **Jost** from Google Fonts as fallback
- Data: **Martian Mono** — Google Fonts
- Urdu UI: **Noto Naskh Arabic** — Google Fonts. *(Use Noto Nastaliq Urdu only for large headings, never for dense UI — it is unreadable at small sizes.)*

**Exit:** `/admin/tokens` shows every colour and type size. No hex value appears anywhere outside the theme block.

---

## STEP 6 — Core primitives

**Goal:** the components every screen will use.

**Prompt:**
> Build these components in `/modules/ui`, styled with the tokens from step 5 and no hardcoded values:
> - `<Money value currency="PKR" />` — takes integer minor units, renders formatted, in Martian Mono
> - `<Measure value unit="in" />` — takes integer hundredths, renders formatted, in Martian Mono
> - `<Ground variant="greige|indigo" />` — surface wrapper
> - `<Eyebrow />` — uppercase 12px, letter-spacing 0.12em
> - `<StitchRule />` — dashed divider, 4px 6px dash, 1px, chalk at 50%
> - `<EmptyState title description action />` — invitation, not an error
> - `<AsyncBoundary />` — loading skeleton + error state
> - `<ConfirmDialog />` — destructive confirmation, madder
>
> Add all of them to the `/admin/tokens` page. Write Vitest tests for `<Money>` and `<Measure>` covering formatting and rounding.

**Exit:** `<Money value={4550000} />` renders `PKR 45,500.00`. `<Measure value={3050} />` renders `30.5″`. Tests pass.

---

## STEP 7 — `transition()` & event pattern

**Goal:** make illegal state changes impossible before any entity has state.

**Prompt:**
> In `/modules/platform`, implement `transition({ entity, id, from, to, actor, note, allowList, tx })`. It must: validate the transition against the allow-list and throw a typed error if illegal; write a row to the entity's `*_events` table in the SAME database transaction as the status change; emit an outbox message. Create a generic events table shape and a helper to create one per entity. Write Vitest tests: a legal transition succeeds and writes exactly one event; an illegal transition throws and writes nothing; a failure inside the transaction rolls back both the status change and the event.

**Exit:** all three tests pass. The rollback test is the important one.

---

## STEP 8 — Outbox & worker skeleton

**Goal:** external side effects never happen inline.

**Prompt:**
> Implement the transactional outbox. `enqueue(topic, payload, tx)` writes to the outbox table inside the caller's transaction. Create a worker process in `/worker` that polls for `status = PENDING AND availableAt <= now()`, dispatches to a handler registry, marks SENT or increments attempts with exponential backoff, and dead-letters after 5 attempts. Add one no-op handler `test.ping` to prove the loop. Add an npm script `worker:dev`. The worker must be a long-lived Node process, not a serverless function.

**Exit:** enqueueing `test.ping` results in a SENT row within seconds. A handler that throws retries with increasing delay and eventually dead-letters.

---

## STEP 9 — Asset storage (R2)

**Goal:** upload and serve files securely.

**Prompt:**
> Implement an asset module in `/modules/platform/assets` backed by Cloudflare R2 via the S3-compatible API. Provide: presigned upload URL generation, a record written to the `assets` table on completion (with sha256, dimensions for images, byte size), signed read URLs with expiry, and a delete function. Add a `purgeExpiredAssets` worker handler that hard-deletes assets past `purgeAt`. No public bucket access — everything through signed URLs.

Create the R2 bucket and API token first; add credentials to `.env.local`.

**Exit:** you upload an image from a test page, it appears in R2, the `assets` row has a correct sha256, and it renders via a signed URL.

---

## STEP 10 — Authentication

**Goal:** real login. No shortcuts, no demo paths.

**Prompt:**
> Implement Auth.js v5 with the Drizzle adapter. **Email OTP only — no password field anywhere, no OAuth for now.** OTP is 6 digits, hashed at rest, 10-minute expiry, single use, rate limited to 5 requests per email per hour and 20 per IP per hour. Send via Resend through the outbox. Bootstrap exactly one OWNER user in the seed script from `OWNER_EMAIL` and `OWNER_NAME` env vars. Add TOTP two-factor: enrolment with QR code, encrypted secret, 10 single-use recovery codes shown once. 2FA is required for OWNER and ADMIN — force enrolment on next sign-in if absent. Sessions record device, IP, last-seen and are individually revocable. Log every sign-in attempt including failures.
>
> **There must be no demo credentials, no hardcoded OTP value, and no bypass path of any kind.**

**Exit:** you sign in to your own email with a real OTP, enrol 2FA with an authenticator app, and reach a protected page. Search the codebase for `000000` — zero results.

---

## STEP 11 — RBAC

**Goal:** permissions enforced where it counts.

**Prompt:**
> Read `/docs/AKS_Admin_Portal_Prompt.md` Part 2. Seed the permission catalogue (`module.action` keys) and the role presets OWNER, ADMIN, MANAGER, STAFF, TAILOR, ACCOUNTANT, READ_ONLY. Implement permission resolution: role defaults, then explicit per-user grant or deny which always wins. Provide `requirePermission(key)` for server actions, throwing on failure. Add middleware protecting `/admin/*`. Provide a `useCan(key)` hook for UI. Enforce at the database level that at least one active OWNER always exists and that an OWNER cannot be deleted or demoted. Write tests: role default grants; explicit deny overrides a role grant; calling a guarded server action without permission throws even when the UI is bypassed.

**Exit:** create a MANAGER; calling a delete server action directly (not via UI) is refused server-side. That specific test is the point of this step.

---

## STEP 12 — Admin shell & staff management

**Goal:** a real portal frame plus the ability to create your team.

**Prompt:**
> Following the layout patterns in `/reference/next-shadcn-dashboard-starter`, build the admin shell: fixed sidebar rail, header with breadcrumbs, content area, indigo ground, 13px density. Navigation items filtered by permission. Add a ⌘K command menu using cmdk. On mobile the rail collapses to a bottom bar. Create placeholder routes for Today, Orders, Designs, Fabric, Customers, Money, Insights, Settings — each rendering `<EmptyState>`.
>
> Then build Settings → Staff: invite by email (creates a `staff_invites` row and sends an invitation through the outbox), assign a role, a permission matrix grid showing inherited / granted / denied per module × action, deactivate a user, view and revoke their sessions. Every mutation wrapped in the audit helper. Do not copy the reference repo's Clerk auth or its client-side RBAC.

**Exit:** you invite a second account as MANAGER; they receive the email, sign in, see a navigation missing Money and Settings, and cannot delete anything. Your role change appears in `audit_logs` with correct before/after.

---

## ✅ MILESTONE — FOUNDATION COMPLETE

You have: real passwordless auth with 2FA, server-enforced permissions, an audit trail, a state-machine primitive, an outbox with a worker, asset storage, the design system, and an admin shell.

**Nothing built after this needs the foundation rewritten.** Continue to file 02.
