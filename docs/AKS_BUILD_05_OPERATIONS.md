# AKS BUILD — 05: OPERATIONS & GROWTH
### Steps 43–50 · fabric, production, money, insights, try-on

> By now you can sell, make, and create a catalog. This file makes the workshop run and the numbers visible.
>
> Reference specs: `/docs/AKS_Tier2_Production_Prompt.md`, `/docs/AKS_Admin_Portal_Prompt.md`.

---

## STEP 43 — Fabric lots & stock automation

**Goal:** inventory in metres, moving by itself.

**Prompt:**
> Extend the `fabrics` table from step 19 **additively** — do not recreate it. Add `reorderPointMeters`, `reorderQuantityMeters`, `defaultSupplierId`.
>
> Create:
> - `fabric_lots` — id, fabricId, lotCode, dyeLotRef, metersReceived, metersOnHand, metersReserved, costPerMeterMinor, supplierId, purchaseOrderId, receivedAt, colourNotes, swatchAssetId (a photo of *this lot*, not the generic fabric), status
> - `fabric_reservations` — id, orderItemId, fabricLotId, metersReserved, status RESERVED|CONSUMED|RELEASED, reservedAt, consumedAt, releasedAt, actualMetersConsumed
> - `suppliers`, `purchase_orders`, `purchase_order_lines`
> - `stock_adjustments` — fabricLotId, deltaMeters signed, reason DAMAGE|SAMPLING|COUNT_CORRECTION|CUTTING_WASTE|RETURN|OTHER, note, actorId. **Append-only.**
> - `trims` — unit-based inventory for buttons, zips, lining
>
> All metre values are integer hundredths of a metre. `available = metersOnHand − metersReserved`.
>
> **Allocation rule — dye lots are not interchangeable.** Two rolls of the same fabric from different dye lots differ subtly in colour, and under daylight a kameez from lot A with a trouser from lot B will visibly mismatch. Implement `allocateFabric` so that: a single lot must cover the whole requirement; components of one garment or suit share a lot where possible; among viable lots choose the oldest (FIFO) to avoid dead stock; and if no single lot suffices, **return an insufficient result and escalate — never split a garment across lots silently.**
>
> Automate the lifecycle: reserve on order confirmation, consume when the production stage reaches Cutting, release on cancellation before cutting. At cutting, the cutter records actual metres used; wastage is `actual − estimated` and is recorded as a stock adjustment.
>
> Emit a low-stock alert through the outbox when available crosses the reorder point, accounting for metres already on open purchase orders.
>
> Tests: allocation never splits a garment; concurrent reservations against one lot do not oversell; a failure during cutting rolls back both the stage change and the stock movement.

**Exit:** confirming an order reserves metres from a specific lot; reaching Cutting depletes stock; cancelling before cutting restores it exactly.

---

## STEP 44 — Production board

**Goal:** the screen Shahneela uses daily, standing in the workshop, on a phone.

**Prompt:**
> Create `staff` (id, name, phone, role CUTTER|STITCHER|EMBROIDERER|FINISHER|QC, capacityPerWeek, isActive, userId nullable), `production_jobs` (id, orderItemId, stage, assignedToId, status PENDING|IN_PROGRESS|BLOCKED|DONE, dueAt, startedAt, completedAt, blockedReason, notes), `production_job_events` (append-only), `qc_checks` (jobId, checklist jsonb, result PASS|FAIL, photoAssetIds, inspectorId, notes), and `rework_orders` (originalOrderItemId, reason, faultAttribution OUR_ERROR|CUSTOMER_MEASUREMENT|FABRIC_DEFECT|UNDETERMINED, costMinor, chargeCustomer, status).
>
> Build `/admin/production` as a kanban board, columns by stage. **Touch-first drag to advance** — this is a mobile screen, not a desktop screen with a mobile fallback. Follow the kanban pattern in `/reference/next-shadcn-dashboard-starter`.
>
> Card face: order number in mono, customer first name, design thumbnail, size mode (`M` or `Custom`), assigned karigar, days to promised ship. Cards turn madder when at risk. Filters URL-synced.
>
> All stage transitions go through `transition()`. **Entering Cutting requires the parent order to be at MEASUREMENTS_CONFIRMED**, and consumes the fabric reservation in the same transaction.
>
> A QC failure creates a rework order and returns the job to the appropriate stage. **Fault attribution determines money** — OUR_ERROR means a free remake, CUSTOMER_MEASUREMENT means a paid alteration offered as such. The immutable measurement snapshot from step 29 is the evidence in that conversation.
>
> Add a workload view: jobs assigned per person per week against capacity. Warn on over-assignment; do not block — the workshop knows its own reality.
>
> **The TAILOR role sees this route and nothing else** — no prices, no customer contact details. Enforce server-side.

**Exit:** you drag a card between stages on your phone; entering Cutting depletes fabric; a TAILOR account can reach nothing but this board.

---

## STEP 45 — Tailor spec sheet

**Goal:** the physical artifact the workshop actually works from.

**Prompt:**
> Build `/admin/production/[jobId]/spec` with a print stylesheet, A4, high contrast, no colour dependence.
>
> Contents: order number, design name, colourway, and **lot code** so the cutter takes the right roll; the **full cut specification** from step 20's calculator rendered as a monospaced table in inches; the standard size label or "MADE TO MEASURE" prominently; the customization specification in plain sentences; fabric name and metres allocated; trims required; embroidery placement notes with the design render as visual reference; the ±0.5″ tolerance note; and the due date.
>
> **Bilingual: English and Urdu side by side.** Use Noto Naskh Arabic for the Urdu — never Nastaliq, which is unreadable in dense tables at small sizes.
>
> Measurements must be large enough to read at arm's length across a cutting table.

**Exit:** the sheet prints correctly on A4 with both languages, and every measurement matches the cut spec exactly.

---

## STEP 46 — Today screen

**Goal:** one screen answering "what needs me right now."

**Prompt:**
> Build `/admin` as the Today screen. **Not charts — a to-do list.** Grouped action cards, each with a live count and a one-tap route:
>
> orders awaiting confirmation · measurements not yet verified (blocks cutting) · orders at risk, past or nearing their promised date · balance payments outstanding · fabric below reorder point · bank transfer receipts awaiting verification · designs awaiting review or publish.
>
> Below: today's numbers — orders placed, revenue, in production, dispatched.
>
> **Every card derives live from real state.** Nothing on this screen is manually maintained.

**Exit:** each card's count matches reality, and tapping one lands on the correct filtered list.

---

## STEP 47 — Money

**Goal:** know whether you are profitable.

**Prompt:**
> Create `rates` (id, kind STITCHING|EMBROIDERY|PACKAGING, name, amountMinor, unit FLAT|PER_HOUR|PER_METRE, active), `recurring_costs` (id, name, category, amountMinor, cycle, startedAt, endedAt, active), and `design_costs` (designId, fabricId, fabricMeters, embroideryRateId nullable, embroideryFlatMinor nullable, stitchingRateId nullable, stitchingFlatMinor nullable, packagingMinor, aiCostMinor, totalCostMinor, sellingPriceMinor, marginPercent).
>
> **Design costing panel** on `/admin/designs/[id]`: she selects a fabric and enters metres, selects stitching and embroidery rates or enters flat amounts, selects trims and quantities. Fabric cost is metres × cost per metre. AI generation cost flows in automatically from `design_generations`. **Total cost and margin percent are computed, never typed**, and margin is colour-coded.
>
> Build `/admin/money`: recurring costs with monthly total; revenue by day, week, month; deposits received versus balances outstanding; margin per design and per order with ranked most and least profitable lists; **outstanding COD** (delivered but not yet remitted — real cash-flow exposure); and break-even — monthly fixed costs against contribution margin, expressed plainly, for example "You need 11 more orders this month to break even."
>
> Permission-gate the whole section behind `money.view`, and margin behind `money.view_margin`.

**Exit:** selecting a fabric and rates on a design computes its total cost and margin with no manual entry; an ACCOUNTANT can see it and a STAFF user cannot.

---

## STEP 48 — Insights & related panels

**Goal:** everything two clicks from everything else.

**Prompt:**
> The mechanism is deliberately simple: **every entity page carries "Related" panels.** No graph database.
>
> - Customer → every order, lifetime value, saved measurement profiles, fabrics purchased, message log
> - Design → orders containing it, revenue, margin, fabric consumed, customers who bought
> - Fabric → designs using it, orders consuming it, metres remaining, cost history, supplier
> - Order → customer, designs, fabric lots used, payments, full timeline
> - Staff → assigned jobs, throughput, current workload
>
> Build `/admin/insights` with reports rendering from the database: sales by design, category and city; **which sizes actually sell** and the average customer measurements, which is what tunes her pattern blocks; made-to-measure versus standard split; promised versus actual lead time; fabric wastage by design; repeat-customer rate. Every table filterable and exportable, every row linking to its entity.
>
> Separately, instrument PostHog for behavioural analytics — page views, sources, funnels. **Do not rebuild web analytics.** Send `orderNumber` and `designId` as properties so a funnel traces back to a real order.

**Exit:** clicking a customer shows her orders; clicking a design shows its margin and the fabric it consumed; the size-distribution report renders.

---

## STEP 49 — Discounts

**Goal:** a revenue lever that cannot bleed money.

**Prompt:**
> Create `discounts` (id, code nullable — null means automatic, name, type PERCENTAGE|FIXED_AMOUNT|FREE_SHIPPING, value, appliesTo ORDER|COLLECTION|DESIGN|GARMENT_TYPE, targetIds array, minSpendMinor, maxDiscountMinor, firstOrderOnly, oncePerCustomer, usageLimit, usageCount, startsAt, endsAt, stackable default false, status) and `discount_redemptions`.
>
> Rules: the discount is **computed server-side and snapshotted onto the order** with its breakdown — a historical order never recomputes. **Non-stackable by default**, with an explicit cap when stacking is enabled; stacking is where discount systems bleed money. Sale pricing uses a scheduled compare-at price rather than a permanent price edit, so the original is recoverable and the price-change audit stays clean.
>
> **Deposit interaction, stated explicitly:** a discount reduces the total, and the deposit percentage applies to the *discounted* total.
>
> Build `/admin/discounts` with a live preview — "a PKR 30,000 order would pay PKR 25,500" — plus usage caps, schedule, and per-discount performance.

**Exit:** a first-order percentage code with a minimum spend applies correctly, snapshots onto the order, and cannot be reused past its cap.

---

## STEP 50 — Try-on (Reflection)

**Goal:** the customer sees herself in the dress.

> **Build this last, deliberately.** It is the flashiest feature and the one most likely to be built too early. It costs money on every use, and its entire justification is conversion lift — which you can only measure now that step 48 exists.

**Prompt:**
> **Architecture — this is the whole feature.** The garment renders are already frozen from step 42. At runtime, apply face-preserving personalisation to each of the three approved angles, **preserving garment pixels**. Never regenerate garment, person and pose together — that drifts identity between angles, costs roughly ten times more, and takes minutes instead of seconds.
>
> Create `tryon_consents` (userId nullable, anonId, version, grantedAt, revokedAt, ipAddress, userAgent), `uploaded_selfies` (consentId, assetId, faceEmbeddingRef nullable, purgeAt, purgedAt), `tryon_sessions`, `tryon_results`.
>
> Flow: a **separate, unbundled, versioned consent checkbox** with its own copy explaining what happens to the photo, that it is deleted within 24 hours, that it is never used for training, and that consent is revocable — **never bundled into terms**. Then upload validation: exactly one face, minimum resolution, not blurred, NSFW classifier. Reject with specific kind guidance such as "We need to see your whole face — try facing a window." Require an attestation that the photo is of herself. Then personalise per angle, burn in the AI-visualization badge, and cache on `hash(faceEmbedding) + designId + colourwayId + archetypeId` — she will toggle colours, so do not pay twice.
>
> A scheduled worker job **hard-deletes** origin selfies at 24 hours. Verify deletion actually happens; do not assume.
>
> Rate limits: 3 per day anonymous, 20 per day signed-in, under the shared monthly spend cap. Graceful degradation — "Reflection is resting — back shortly." **The store must stay fully transactional when try-on is unavailable.**
>
> Add a share card: a branded image of the result sized for WhatsApp. In this market the purchase decision is collective — she sends it to the family group.
>
> Build `/admin/tryon`: session logs, conversion rate from try-on to cart, consent records with version, purge job status with manual purge, cache management per design, quota configuration, spend against cap.

**Note on data protection:** Pakistan-only operation materially reduces your legal exposure compared with selling into the EU or US. **Build the consent, retention and deletion machinery properly anyway** — it is the right treatment of someone's face, it future-proofs any later expansion to the diaspora that would otherwise require a rebuild, and Pakistan may legislate. The cost now is small; retrofitting it is a rewrite.

**Exit:** a customer consents, uploads a selfie, receives three labelled angles in seconds, toggles colour without a second charge, and her selfie is verifiably hard-deleted 24 hours later.

---

## ✅ COMPLETE

You can now run the entire business from the portal: create designs from paper sketches, size them correctly, sell them, take payment, cut and stitch them, ship them, keep the customer informed automatically, and see exactly what it all costs.

---

## What deliberately isn't built

**The customer-facing 3D size guide.** Specified in `/docs/AKS_Sizing_System_Complete.md` Part 11. Build it only if the 3D asset cost (roughly $500–2,000 for a rigged mannequin with morph targets) is justified by demand. ⚠️ **SMPL/SMPL-X is research-licensed only — it must not enter a commercial codebase.**

**Marketing automation** — abandoned cart and try-on recovery, Meta catalog sync, WhatsApp broadcast. Add once you have traffic worth recovering.

**Reviews and fit feedback.** Worth adding early once you have delivered orders — structured fit responses ("shoulder → tight") aggregate into suggested size-block adjustments, which is the loop that makes your fit measurably better over time. Spec in `/docs/AKS_Tier4_Growth_Prompt.md` Phase B.
