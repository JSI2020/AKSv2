# AKS — BUILD INDEX
### Start here. Method, rules, and the complete step list.

**Project:** AKS by Shahneela (عکس) — made-to-order Pakistani womenswear, Pakistan-only delivery.
**Backbone:** design creation from a paper sketch or photo, and the sizing mechanism.
**Repo:** new, from scratch.

---

## THE SIX FILES

| File | Covers | Steps |
|---|---|---|
| **00 — Index** (this) | Method, `.cursorrules`, step list | — |
| **01 — Foundation** | Repo, database, tokens, auth, RBAC, admin shell | 1–12 |
| **02 — Sizing Engine** | Categories, size blocks, grading, ease, archetypes, cut spec | 13–20 |
| **03 — Commerce** | Catalog, storefront, cart, orders, payments, fulfilment | 21–34 |
| **04 — Design Studio** | Sketch → hero → sizing overlay → angles → colourways | 35–42 |
| **05 — Operations & Growth** | Fabric, production, money, insights, try-on | 43–50 |

---

## THE METHOD — read this twice

The previous build failed because whole specifications were handed over at once. **This is the fix.**

1. **One step, one fresh Cursor chat.** Never two steps in one session. Context bleeding between steps causes drift.
2. **Paste the step's prompt verbatim.** Add nothing except: *"Follow `.cursorrules`."*
3. **Verify the exit criterion yourself** — click it, don't read a summary of it.
4. **Fix now, not later.** Do not proceed with a known defect.
5. **Commit with the step number:** `git commit -m "step 14: grading engine"`.
6. If a step takes more than one session, it was too big — split it and tell me.

**Do not skip steps. Do not reorder them.** The order encodes dependencies: sizing before catalog because a design needs a size chart; commerce before Design Studio because Design Studio writes into tables catalog creates.

---

## REFERENCES

**Admin patterns (clone, don't merge):**
```
https://github.com/Kiranism/next-shadcn-dashboard-starter
```
Clone into `/reference/` and add `reference/` to `.gitignore`. Copy its **table, form, layout and kanban patterns**.

⚠️ **Do NOT copy from it:** its Clerk authentication, or its RBAC — which is client-side navigation filtering only. That is UI hiding, not security. Yours must be enforced server-side.

**Storefront:** you will supply a prototype. Steps 22–26 are written to implement *your* prototype's visual design while enforcing the data rules that must hold regardless of how it looks.

**Specs:** keep the existing `AKS_*.md` documents in `/docs/`. Steps reference them by name; Cursor reads the relevant part when told to.

---

## `.cursorrules` — create this before step 1

Copy exactly to repo root:

```
# AKS — project rules. Violating these is a bug, not a preference.

## Stack (fixed — never substitute)
Next.js 15 App Router · TypeScript strict · Tailwind v4 · shadcn/ui
Drizzle ORM + PostgreSQL · Auth.js v5 · Zod · React Hook Form · nuqs
Redis + BullMQ for jobs · Cloudflare R2 for assets · Resend for email

## Data rules
- Money: integer minor units (PKR paisa). NEVER floats.
- Measurements: integer hundredths of an inch. NEVER floats.
- Metres: integer hundredths. NEVER floats.
- Snapshots on orders (price, measurements, address, customization) are
  IMMUTABLE COPIES, never foreign keys to mutable records.
- Primary keys: UUIDv7, generated in application code.

## Architecture rules
- Status changes go through transition(), which writes an event row in the
  SAME transaction. NEVER a raw UPDATE on a status column.
- Permissions enforced SERVER-SIDE on every mutation. UI hiding is not security.
- External side effects (email, WhatsApp, AI jobs) go through the outbox table.
  NEVER an inline call.
- No vendor SDK imported outside its adapter in /modules/*/providers/.
- Every admin mutation writes an audit_log row.
- Sizing math is deterministic arithmetic. AI NEVER computes a measurement.

## Auth rules
- Passwordless only. No password field, ever.
- No public signup for admin. Owner creates all staff accounts.
- NO demo credentials, no hardcoded OTP, no bypass paths. Ever.

## UI rules
- Six colours only:
  greige #DCD9CF · ink #16181D · indigo #1B2547
  chalk #8FA6B2 · zari #B08D4C · madder #8C2F39
- One radius: 2px. No shadows. No gradients.
- Admin = indigo ground, 13px density. Storefront = greige ground, no dark mode.
- Logical properties only (padding-inline-start), NEVER left/right — RTL from day one.
- <Money> renders every price. <Measure> renders every measurement.

## Working rules
- Follow patterns in /reference/next-shadcn-dashboard-starter for tables, forms,
  layout, kanban. Do NOT copy its Clerk auth or client-side-only RBAC.
- Read /docs/*.md only when the current step references them.
- Implement ONLY the current step. Do not build ahead.
- If an instruction conflicts with these rules, say so before proceeding.
```

---

## COMPLETE STEP LIST

### 01 — Foundation
1. Repo skeleton & tooling
2. Reference repo & docs
3. Database connection & migration workflow
4. Core schema: identity & platform
5. Design tokens & fonts
6. Core primitives
7. `transition()` & event pattern
8. Outbox & worker skeleton
9. Asset storage (R2)
10. Authentication (passwordless OTP + 2FA)
11. RBAC: permissions, roles, enforcement
12. Admin shell & staff management

### 02 — Sizing Engine *(backbone, part 1)*
13. Categories & measurement keys
14. Size blocks schema & seed
15. **Grading engine (pure functions + tests)**
16. Size chart editor UI
17. Pinning, fork-on-edit, revert
18. Fit profiles (ease)
19. Fabrics (minimal) & archetypes
20. **Cut-spec calculator**

### 03 — Commerce
21. Catalog schema & admin CRUD
22. Storefront shell (from your prototype)
23. Collection & filtering
24. Product detail page
25. Size selection & guide
26. Custom measurement flow
27. Cart
28. Checkout & Pakistani address
29. Orders schema & state machine
30. Admin order list & detail
31. Manual order entry
32. Payments: interface & Safepay
33. Bank transfer & COD
34. Status pipeline & automatic notifications

### 04 — Design Studio *(backbone, part 2)*
35. Studio settings & prompt templates
36. fal.ai adapter & job queue
37. Design brief (dropdown-driven)
38. Input set & sketch preprocessing
39. **Hero generation loop**
40. **Calibrated sizing overlay**
41. Angles
42. Colourways & publish

### 05 — Operations & Growth
43. Fabric lots & stock automation
44. Production board
45. Tailor spec sheet
46. Today screen
47. Money
48. Insights & related panels
49. Discounts
50. Try-on (Reflection)

---

## MILESTONES

| After step | You can |
|---|---|
| **12** | Sign in as Owner, create staff with limited rights |
| **20** | Define categories, size charts, and generate a tailor's cut spec |
| **34** | **Take a real paid order and fulfil it** ← switch the domain here |
| **42** | Turn a paper sketch into a published design without a photoshoot |
| **50** | Run the whole business from the portal |

---

## WHAT NOT TO DO

- ❌ Never paste a whole spec document as a prompt
- ❌ Never build two steps in one session
- ❌ Never proceed with "I'll fix that later"
- ❌ Never copy Clerk auth or client-side RBAC from the reference repo
- ❌ Never use a Shopify/Medusa e-commerce template — their data models cannot express fabric-in-metres, made-to-measure, or 50/50 deposits
- ❌ Never build the Design Studio before you can take an order

---

## A NOTE ON VERIFICATION

Some external details change faster than any document can track. **Verify these at build time rather than trusting this file:**

- fal.ai model IDs and per-image prices — check the fal dashboard
- Safepay API request/response shapes — check current Safepay docs
- WhatsApp Cloud API template rules — check Meta's current policy
- npm package major versions — check before installing

Where a step says "verify current," do that. Do not let Cursor invent an API signature.
