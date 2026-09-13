# Launch with real data — step by step

Load the live shop using **brand catalogue data** (`house-catalogue-looks.ts`, `FABRIC_SEEDS`) through the **same admin publish path** the production app uses — not hand-inserted rows.

> The Claude artifact link could not be fetched from here; this plan follows `docs/AKS_Tier1_RealShop_Prompt.md` and the house catalogue in the repo.

---

## Overview

| Step | Command | What you get |
|------|---------|--------------|
| **1** | `npm run launch:1` | Real fabrics, fit profiles, house models, custom size limits |
| **2** | `npm run launch:2` | **50 published designs** (10 × Essentials / Tailored / Occasion / Signature / Separates) |
| **3** | `npm run launch:3` | RTW stock + fabric lots (storefront can sell) |
| **4** | `npm run launch:4` | Homepage, nav, hero, category doors |
| **5** | `npm run launch:5` | Launch audit + counts |

**Prerequisites:** Postgres up, `npm run db:migrate`, owner in `.env.local` (`OWNER_EMAIL`), dev server for browsing.

**All steps:**

```bash
npm run launch:all
```

---

## Step 1 — Foundation (fabrics & sizing)

Real fabric library from `packages/shared/fabric-archetype-seeds.ts`:

- Lawn, Khaddar, Linen, Silk crepe, Georgette, Organza, etc.
- Fit profiles per garment category
- House model archetypes (Regular, Petite, …)
- Custom size limits for MTM bounds

**Verify in admin:** Create → Fabric — list should show active fabrics with cost/metre.

---

## Step 2 — Catalogue (50 looks)

Publishes `HOUSE_CATALOGUE_LOOKS` via `catalogue-writer` (create → checklist → publish + audit).

- Slugs like `essentials-khaddi-everyday-kurta` (not `demo-*`)
- Two colourways per design (fashion swatch hexes)
- Tags: house door + occasion + PLAIN work
- Placeholder front render (swap for real photography in Design Studio)

**Verify on storefront:**

- http://localhost:3000/en/collections/essentials
- http://localhost:3000/en/collections/signature
- Open any PDP — size picker + price

---

## Step 3 — Inventory

- RTW rows for every published design (XS–XL)
- Fabric lots so checkout/reservations work

**Verify in admin:** Inventory → Designs — on-hand qty per size.

---

## Step 4 — Content

- Published homepage, four house doors, nav, hero copy (brand-aligned)

**Verify:** http://localhost:3000/en

---

## Step 5 — Audit

Runs `audit:launch-catalogue` — reports blockers (missing ghosts, empty charts, zero stock).

Sizing ghosts still need **Recognise sizing** in Design Studio per design if you want `--strict` clean.

---

## After launch — test a real order flow

1. Storefront → pick a design → size → add to cart  
2. Checkout (Safepay test / COD per your `.env`)  
3. Admin → Orders → advance status  

---

## Staff & admin access

| Email | Role |
|-------|------|
| `owner@aks.local` | OWNER |
| `admin@aks.local` | ADMIN |
| `manager@aks.local` | MANAGER |
| `staff@aks.local` | STAFF |
| `tailor@aks.local` | TAILOR |
| `accountant@aks.local` | ACCOUNTANT |

Sign in: `/admin/login` → Send code (dev auto-fills OTP).

---

## Replace placeholders with your assets

1. **Fabrics** — edit cost, supplier, real swatch photos in admin  
2. **Designs** — upload FRONT / THREE_QUARTER / BACK per colourway  
3. **Sizing** — Recognise sizing for ghost + chart  
4. **Prices** — adjust PKR in Design → Pricing  
5. **Content** — hero images, announcement ticker in Content & Settings  

Do these **after** steps 1–4 so the skeleton is live first.
