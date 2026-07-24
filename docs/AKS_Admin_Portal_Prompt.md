# AKS — ADMIN PORTAL
### Complete implementation prompt · real authentication, automation-first

> **For:** Cursor · brownfield repo at `C:\Personal\Agentic AI\AKS`
> **⚠️ DO NOT CHANGE:** the design creation flow — sketch upload, input roles, hero loop, sizing, calibrated overlay, angles, colourways. That is specified in **`AKS_Design_And_Sizing_Unified.md`** and remains authoritative and unchanged. This document adds the portal *around* it, and applies the dropdown principle to its inputs. Nothing here modifies how a design is created.

---

# PART 0 — INSTRUCTION

You are building the AKS admin portal: the tool one designer uses to run a made-to-order womenswear business from a phone and a laptop.

Three principles govern every decision. When in doubt, re-read these:

1. **Automate to the limit.** If a value can be computed, compute it. If a notification can fire itself, fire it. If a status can be derived, derive it. Manual entry is a last resort, not a default.
2. **Define once, select everywhere.** Every reusable value — fabric, rate, category, courier, staff member — is defined in one place and *selected from a dropdown* everywhere else. Nothing is ever typed twice.
3. **Simple means fewer decisions, not fewer features.** Depth is fine; friction is not.

## 0.1 Survey first

Brownfield repo. Before writing code, report: existing stack, what's scaffolded vs. stubbed, current schema state, current auth implementation, and any conflict with this spec. **Do not scaffold over existing work.** Report and wait for approval.

## 0.2 Structure — eight sections, in this order

```
1. TODAY      what needs me right now
2. ORDERS     the spine
3. DESIGNS    catalog + creation (unchanged flow) + costing
4. FABRIC     stock in metres, lots, suppliers
5. CUSTOMERS  people, history, measurements
6. MONEY      costs, revenue, margin
7. INSIGHTS   interlinked exploration
8. SETTINGS   the "define once" values live here
```

---

# PART 1 — AUTHENTICATION & ACCESS (build this first)

## 1.1 The rules

- **No public signup for admin.** Ever. There is no "create staff account" form on the internet.
- **The Owner creates every account.** Accounts are created from inside the portal by someone holding the `staff.create` permission.
- **Passwordless email OTP.** No password fields anywhere. 6-digit code, 10-minute expiry, single use, rate-limited per email and per IP.
- **Remove any demo/bypass credentials.** No hardcoded OTP, no seeded demo login on a public page. If one exists in the repo, delete the code path — not just the on-screen text.
- **2FA (TOTP) required** for OWNER and ADMIN; optional but encouraged for others.

## 1.2 The Owner account

Exactly one bootstrap account, created by the seed script from environment variables:

```
OWNER_EMAIL=...
OWNER_NAME=...
```

The Owner:
- Holds every permission implicitly, including `staff.create` and `staff.assign_permissions`
- **Cannot be deleted or demoted** — enforce at the database level (at least one active OWNER must exist)
- Is the only role that can create another OWNER or ADMIN

## 1.3 Account creation flow

Owner → **Settings → Staff → Invite** → enters name, email, role, optional permission overrides → system sends an invite email → invitee clicks, receives OTP, sets up 2FA if required, lands in the portal.

No password is ever set, transmitted, or stored.

## 1.4 Session & security

Sessions with device, IP, last-seen; revoke individually or all. Login history including failures. Idle timeout (configurable, default 12h). Force-logout available to the Owner.

---

# PART 2 — PERMISSION MODEL

## 2.1 Permission keys

Format `module.action`. Seed this catalogue:

| Module | Actions |
|---|---|
| `orders` | view · create · edit · advance_status · refund · cancel · delete |
| `designs` | view · create · edit · publish · delete |
| `fabric` | view · create · edit · adjust_stock · delete |
| `customers` | view · edit · export · delete |
| `money` | view · edit_costs · view_margin |
| `insights` | view |
| `settings` | view · edit · edit_financial |
| `staff` | view · create · edit · assign_permissions · deactivate |
| `production` | view · advance_stage · assign |

## 2.2 Roles (presets, not limits)

| Role | Shape |
|---|---|
| **OWNER** | Everything. Cannot be deleted. Only role that can create OWNER/ADMIN. |
| **ADMIN** | Everything except creating OWNERs and `settings.edit_financial` |
| **MANAGER** | Orders, designs, fabric, customers, production — **create and edit, no delete**. No money. |
| **STAFF** | Orders + production: view, edit, advance status. No delete, no money, no settings. |
| **TAILOR** | **Production board only.** No prices, no customer contact details. |
| **ACCOUNTANT** | Money (full) + read-only everywhere else |
| **READ_ONLY** | View everything, change nothing |

This directly implements what you described: *read but not write* → READ_ONLY · *write but not delete* → MANAGER · *can create staff* → `staff.create` · *complete rights* → OWNER.

## 2.3 Per-user overrides

Any permission can be granted or revoked on an individual, on top of their role. The staff editor shows a **permission matrix** — modules down, actions across, three states per cell: inherited from role · explicitly granted · explicitly denied. Explicit always beats inherited.

## 2.4 Enforcement — all three layers, always

1. **Route middleware** on `/admin/*`
2. **Server action / route handler** — `requirePermission('orders.refund')` at the top of every mutation
3. **UI** — hide or disable what the user cannot do, so the interface never offers a dead end

Server-side is the gate. UI hiding is courtesy, never security. Test that a permission cannot be bypassed by calling a server action directly.

---

# PART 3 — THE AUTOMATION LIST

Everything below happens **without anyone clicking anything**. This is the spec for "automatic up to the level possible."

| Automatic | Trigger |
|---|---|
| Order number (`AKS-2026-00042`) | Order created |
| **Customer email + WhatsApp on every status change** | Status transition |
| Customer account order view updates | Status transition |
| Promised ship date | Order placed — from lead-time rules + current queue depth |
| At-risk flag on an order | Promised date approaching or passed |
| Fabric reserved | Order confirmed |
| Fabric depleted | Stage reaches *Cutting* |
| Fabric released | Order cancelled before cutting |
| Low-stock alert on Today | Available metres cross the reorder point |
| **Design total cost** | Any input changes (fabric, rates, trims, AI spend) |
| **Margin %** | Cost or price changes |
| AI generation cost added to design cost | Design Studio job completes |
| Customer lifetime value, order count | Order reaches paid |
| COD auto-disabled | Customer refuses a delivery once |
| New arrivals / best sellers / back-in-stock | Computed from data — **never hand-tagged** |
| Today's action list | Continuously, from live state |
| Balance-due reminder | Configurable days before dispatch |
| Review request | 7 days after delivered |

**Rule: if a number can be derived, it is never a field someone types.** If you find yourself adding a "mark as best seller" checkbox or a "total cost" input, stop — that's the bug.

---

# PART 4 — THE DROPDOWN PRINCIPLE

Every reusable value is **defined once in Settings or its own section**, then **selected** everywhere else.

| Selected from a dropdown | Defined in |
|---|---|
| Fabric (with cost/metre attached) | Fabric section |
| Fabric lot | Fabric section |
| Garment category | Settings → Categories |
| Occasion, season, work type | Settings → Taxonomy |
| Size block, fit profile | Settings → Sizing |
| House model / archetype | Settings → Sizing |
| Stitching rate, embroidery rate | Settings → Rates |
| Trims (buttons, zip, lining) | Settings → Trims |
| Packaging cost | Settings → Rates |
| Courier | Settings → Shipping |
| Staff member (for assignment) | Settings → Staff |
| Discount | Discounts |
| Cancellation / adjustment reason | Settings → Reasons |

Every dropdown supports **type-to-search** and an inline **"+ Add new"** that creates the record without leaving the screen. Free text is permitted only for genuinely unique content: names, descriptions, notes, remarks.

---

# PART 5 — UX PRINCIPLES

- **Today is the home screen.** Not a dashboard of charts — a to-do list.
- **Two independent status tracks** on every order: production status *and* payment status. Never one combined field.
- **Every entity page has "Related" panels** (Part 12) — this is how the interlinked exploration works.
- **Global search + ⌘K** — jump to any order, customer, design, fabric by name or number.
- **Inline editing** where safe; autosave with optimistic UI; toast on failure with retry.
- **Never a modal inside a modal.** Use drawers or side panels.
- **Production board is mobile-first**, touch-drag. She uses it standing in the workshop.
- **Destructive actions** require typed confirmation and are permission-gated.
- **Empty states are invitations** — *"No orders in the workshop. Enjoy it."* not *"No records found."*
- **Copy follows `AKS_Brand_Foundation.md`** — warm, plain, second person. Buttons say what happens.
- Design tokens from Module 1: indigo admin ground, 13px density, `<Money>` for every price, `<Measure>` for every measurement, one 2px radius, no shadows.

---

# PART 6 — SECTION 1: TODAY

The most valuable screen in the portal. Answers one question: **what needs me right now?**

Grouped action cards, each with a count and a one-tap route:

- Orders awaiting confirmation
- Measurements not yet verified *(blocks cutting)*
- Orders at risk — past or nearing promised date
- Balance payments outstanding
- Fabric below reorder point
- Bank transfer receipts awaiting verification
- Designs awaiting review or publish
- Unread customer messages

Below: today's numbers — orders placed, revenue, in production, dispatched.

Everything is derived live. Nothing here is manually maintained.

---

# PART 7 — SECTION 2: ORDERS

## 7.1 List

Columns: order number · customer · date · **production status** · **payment status** · total · promised date · at-risk flag.
Filters (URL-synced): status, payment state, date range, at-risk, source, size mode. Saved views. Bulk: advance status, print, export.

## 7.2 Detail

One screen, everything:

- **Customer** — name, phone, WhatsApp, email; link to their profile
- **Shipping address** — full, as a snapshot (frozen at order time)
- **Items** — design, colourway, **size mode**: standard label *or* the full custom measurement table; customization selections; price breakdown per line
- **Payment** — plan, deposit received, balance due, method, receipts
- **Production** — current stage, assigned karigar, due date
- **Timeline** — every status change with timestamp, actor, and remark. Append-only.
- **Remarks** — internal (never shown to customer) and customer-visible notes, clearly separated
- **Photos** — upload at any stage; delivery proof; optionally pushed to the customer's order view
- **Print** — invoice · packing slip · **tailor spec sheet** (bilingual, with the actual cut measurements)

## 7.3 Pipeline

Fixed stages, in order:

```
Received → Confirmed → Measurements verified → Cutting → Stitching
        → Embroidery* → Finishing → Quality check → Packed
        → Dispatched → Delivered → Completed
```

`*` optional — skipped automatically when the design has no embroidery.

Side exits: Cancelled (only before *Measurements verified*) · Refunded · Delivery refused.

**Rules:**
- **Cutting cannot start before *Measurements verified*.** Once cloth is cut to her measurements it can't become anyone else's garment. This gate is enforced in code, not by convention.
- Every stage change: select stage → optional remark → save. **Email + WhatsApp to the customer fire automatically.** Customer's order page updates automatically.
- Reaching *Cutting* depletes the reserved fabric automatically.

## 7.4 Also required

- **Manual order entry** — WhatsApp and Instagram sales. Without it your order data is fiction, and every report built on it is wrong.
- Cancel with reason (dropdown) · refund (full/partial) · price adjustment with reason
- Guest order tracking by order number + OTP

---

# PART 8 — SECTION 3: DESIGNS

## 8.1 Creation — unchanged

The sketch → hero → sizing → angles → colourways flow is **exactly as specified in `AKS_Design_And_Sizing_Unified.md`**. Do not alter it.

Apply only the dropdown principle to its inputs: fabric, category, archetype, size block, and fit profile are **selected**, never typed. Which is already how that spec describes them.

## 8.2 Design costing ⭐ — the highest-value addition

Every design gets a cost breakdown, built entirely from dropdown selections:

| Line | Source | Computed |
|---|---|---|
| Fabric | select fabric + enter metres | metres × cost/metre |
| Embroidery | select rate, or flat amount | auto |
| Stitching | select rate, or flat amount | auto |
| Trims | select from trims list, quantities | auto |
| Packaging | from Settings | auto |
| AI generation | from Design Studio | **automatic** |
| **Total cost** | | **computed** |
| Selling price | entered | |
| **Margin %** | | **computed, colour-coded** |

She selects; the system calculates. Margin is never typed and never guessed.

> Most small labels don't know their per-design margin, so they price by feel and discount into a loss. This panel prevents that — and it feeds Money and Insights for free.

## 8.3 Design management

- Categories: occasion, season, work type, garment type — all multi-select dropdowns
- **Display**: featured on homepage (toggle) · which collections · sort order
- Price, compare-at price, discount (select an existing discount, don't retype)
- Status: draft / published / archived
- Stock-linked availability: automatically unavailable when its fabric is out
- Bulk edit and duplicate

---

# PART 9 — SECTION 4: FABRIC

- **Fabric records** — name, composition, weight, width, care, swatch photo, **cost per metre**, supplier, reorder point. This record is the source for every fabric dropdown in the system.
- **Lots** — fabric arrives in lots. Track lot code, metres received, metres on hand, metres reserved, cost, received date.
  ⚠️ **Dye lots differ in colour.** Two rolls of the same fabric won't match in daylight. **Cut one garment from one lot** — never split a garment across lots. If no single lot has enough, flag it rather than splitting silently.
- **Automatic stock movement** — reserved on order confirmation, depleted at cutting, released on cancellation.
- **Low-stock alerts** → Today.
- **Suppliers and purchase orders** — receiving a PO line creates a lot automatically.
- **Trims** — simple unit inventory feeding the design cost dropdown.

---

# PART 10 — SECTION 5: CUSTOMERS

- List: name, phone, orders, lifetime value, last order. Search by name, phone, WhatsApp, email.
- Detail: contact, addresses (Pakistani format — province select, optional postal code, **landmark field**), **saved measurement profiles** (so a repeat order is one tap), full order history, notes, tags, communication log.
- **COD refusal count** — automatically disables cash-on-delivery after one refusal, shown clearly on the profile.
- Export customer data; delete account (permission-gated).
- Customers are created automatically by orders; no manual signup needed.

---

# PART 11 — SECTION 6: MONEY

Answers one question: **am I profitable?**

- **Recurring costs** — domain, hosting, database, AI/API, courier account, tools. Each with amount and billing cycle; monthly total computed.
- **Variable costs** — per order: fabric consumed (actual, at cost), stitching, embroidery, trims, packaging, courier, payment gateway fee.
- **Revenue** — by day, week, month; deposits received vs. balances outstanding.
- **Margin** — per design (from §8.2), per order, overall. Ranked lists: most and least profitable designs.
- **Outstanding COD** — money delivered but not yet remitted by the courier. This is real cash-flow exposure; surface it prominently.
- **Break-even** — monthly fixed costs vs. contribution margin. *"You need 11 more orders this month to break even."*
- Export for accounting.

Permission-gated: `money.view` and `money.view_margin`.

---

# PART 12 — SECTION 7: INSIGHTS

Your interlinked explorer. The concrete mechanism: **every entity page carries "Related" panels**, so everything is two clicks from everything else. No graph database needed.

| Click… | See… |
|---|---|
| **Customer** | Every order · lifetime value · saved measurements · fabrics she's bought · messages |
| **Design** | Orders containing it · revenue · margin · fabric consumed · customers who bought · fit feedback |
| **Fabric** | Designs using it · orders consuming it · metres remaining · cost trend · supplier |
| **Order** | Customer · designs · fabric lots used · payments · full timeline |
| **Staff/karigar** | Assigned jobs · throughput · current workload |

Plus reports: sales by design/category/city · **which sizes actually sell** (this tunes her pattern blocks) · made-to-measure vs. standard split · promised vs. actual lead time · fabric wastage · repeat-customer rate.

Every table is filterable and exportable. Every row links to its entity.

---

# PART 13 — SECTION 8: SETTINGS

Where all the "define once" values live.

- **Staff** — invite, roles, permission matrix, deactivate, sessions, login history
- **Rates** — stitching, embroidery, packaging (feed design costing)
- **Taxonomy** — categories, occasions, seasons, work types
- **Sizing** — size blocks, fit profiles, archetypes, custom-size limits *(per the unified sizing spec)*
- **Trims** — buttons, zips, lining
- **Shipping** — couriers, rates by city tier
- **Payments** — providers, payment plan rules, bank details for transfers
- **Lead times** — base days per garment type, buffer, holidays
- **Notifications** — which events send email/WhatsApp; template editor
- **Reasons** — cancellation, adjustment, stock-adjustment reason lists
- **Business** — name, NTN, address, logo
- **AI** — provider config, monthly spend cap, kill switch
- **Backups** — status, last restore drill

---

# PART 14 — DATA MODEL ADDITIONS

Beyond what earlier specs define:

```
permissions            key, module, action, description
role_permissions       role, permissionKey, granted
user_permissions       userId, permissionKey, granted    -- explicit override
staff_invites          id, email, role, token(hashed), invitedById, expiresAt, acceptedAt

order_status_history   orderId, fromStatus, toStatus, actorId, remark,
                       notifiedAt, createdAt             -- APPEND ONLY
order_photos           orderId, stage, assetId, isCustomerVisible, uploadedById

design_costs           designId, fabricId, fabricMeters,
                       embroideryRateId?, embroideryFlatMinor?,
                       stitchingRateId?, stitchingFlatMinor?,
                       packagingMinor, aiCostMinor,
                       totalCostMinor,                   -- COMPUTED
                       sellingPriceMinor, marginPercent  -- COMPUTED

rates                  id, kind (STITCHING|EMBROIDERY|PACKAGING),
                       name, amountMinor, unit (FLAT|PER_HOUR|PER_METRE), active

recurring_costs        id, name, category, amountMinor, cycle, startedAt, endedAt, active
reason_codes           id, kind, label, sortOrder, active
```

All money as **integer minor units (PKR paisa)**. All measurements as **integer hundredths of an inch**. Metres as integer hundredths. **Never floats.**

---

# PART 15 — BUILD ORDER (step by step)

| # | Step | Exit criterion |
|---|---|---|
| 1 | Survey & reconciliation report | Plan approved |
| 2 | **Remove all demo/bypass credentials** | No hardcoded OTP or seeded demo login exists in the codebase |
| 3 | Permission catalogue + role presets + seed | Permissions table populated |
| 4 | **Owner bootstrap from env + OTP login + 2FA** | You sign in as Owner, passwordless, with 2FA |
| 5 | Staff invite flow + permission matrix UI | Owner creates a MANAGER; they cannot delete anything |
| 6 | Three-layer enforcement + tests | A permission cannot be bypassed by calling a server action directly |
| 7 | Admin shell: nav (permission-filtered), ⌘K, search | A TAILOR sees only Production |
| 8 | Settings → Rates, Taxonomy, Reasons, Trims | The "define once" values exist for dropdowns to read |
| 9 | Fabric: records, lots, stock, suppliers | Fabric dropdown works with cost/metre attached |
| 10 | Customers | Profile with history and saved measurements |
| 11 | **Orders: list, detail, pipeline, auto-notifications** | Status change fires email + WhatsApp and updates the customer view automatically |
| 12 | Manual order entry | A WhatsApp sale is enterable |
| 13 | Order photos + delivery proof + prints | Spec sheet and invoice print correctly |
| 14 | Fabric automation | Reserve on confirm, deplete at cutting, release on cancel |
| 15 | **Design costing panel** | Selecting fabric + rates computes total cost and margin automatically |
| 16 | Design management (categories, display, discount) | All selections are dropdowns |
| 17 | **Today screen** | Every card derives live from real state |
| 18 | Money section | Recurring + variable costs, revenue, margin, break-even |
| 19 | **Insights + Related panels** | Clicking a customer shows their orders; clicking a design shows its margin and fabric |
| 20 | Audit log across all mutations | Every change recorded with actor and before/after |

**Overall exit criterion:**

> You sign in as Owner with a real OTP and 2FA, create a MANAGER account that can edit but not delete and a TAILOR who sees only the production board. You add a fabric with its cost per metre. A design created through the existing sketch flow selects that fabric from a dropdown, and its total cost and margin compute themselves. An order arrives, reserves fabric automatically, and each status change you set sends the customer an email and WhatsApp without you doing anything. Today shows exactly what needs you. Clicking that customer shows her full history; clicking the design shows its margin and the fabric it consumed.

---

# PART 16 — NON-NEGOTIABLES

1. **No public signup for admin.** Accounts are created only from inside the portal by someone with `staff.create`.
2. **No demo or bypass credentials anywhere.** Delete the code path, not just the on-screen text.
3. Passwordless only. No password field is ever added.
4. At least one active OWNER must always exist; the Owner cannot be deleted or demoted.
5. Permissions enforced **server-side on every mutation**. UI hiding is courtesy, not security.
6. Explicit per-user grant/deny always beats the role default.
7. **Cutting cannot begin before *Measurements verified*.**
8. **A garment is never cut across two dye lots.** No single lot big enough → flag, never split.
9. Every status change **automatically** notifies the customer and updates their order view.
10. Production status and payment status are **two independent fields**. Never combined.
11. **Derived values are never typed.** Cost, margin, best-sellers, promised dates, LTV — all computed.
12. Every reusable value is **selected from a dropdown**, defined once. Free text only for names, descriptions and remarks.
13. Money is integer minor units; measurements integer hundredths of an inch; metres integer hundredths. **Never floats.**
14. Order status history and audit logs are **append-only**.
15. Every admin mutation writes an audit log with actor, entity, before and after.
16. TAILOR sees the production board only — no prices, no customer contact details. Enforced server-side.
17. **The design creation flow is unchanged.** Sketch, input roles, hero loop, sizing, overlay, angles, colourways stay exactly as specified in `AKS_Design_And_Sizing_Unified.md`.
