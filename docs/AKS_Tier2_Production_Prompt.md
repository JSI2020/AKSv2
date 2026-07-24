# AKS — TIER 2: MAKE MADE-TO-ORDER REAL
### Modules 6 (Fabric & Inventory) + 8 (Production / Workshop) + Lead Time Engine

> **For:** Cursor · brownfield repo at `C:\Personal\Agentic AI\AKS`
> **Depends on:** Module 1 (Foundation) · Module 3 (Size System) · **Module 7 (Orders) — must be complete**
> **Companion docs:** `AKS_Complete_Build_Document.md`, `AKS_Module1_Foundation_Prompt.md`, `AKS_Module3_SizeSystem_Prompt.md`
> **Position:** Tier 2 of the build order — after the store can take a paid order, before the AI catalog.

---

# PART 0 — INSTRUCTION

Tier 1 made AKS able to **take** an order. Tier 2 makes it able to **make** one.

You are building the operational spine of a made-to-order atelier: fabric tracked in metres rather than garments in units, a workshop where real people cut and stitch, a printable specification the tailor works from, and a lead-time engine that promises only what the workshop can actually deliver.

Two modules, built in sequence. They are tightly coupled — fabric is consumed by a production stage event — so build inventory first, then production, then wire them together.

## 0.1 Before writing code

Confirm Modules 1, 3 and 7 are complete and demonstrated. Then report:
- Which Module 1 primitives you'll use (`transition()`, `withAudit`, outbox, `<Measure>`, `<DataTable>`)
- The exact shape of `orders` / `order_items` from Module 7, since fabric reservation and production jobs both attach to order items
- The `calculateCutSpec()` signature from Module 3, which the tailor spec sheet consumes
- Any gaps you need closed first

**Do not proceed if Orders is incomplete.** Reserving fabric against an order that doesn't exist is not implementable.

## 0.2 Scope boundary

**In scope:** fabric lots and reservations, suppliers and purchase orders, trims, stock adjustments, wastage, the production board, karigar assignment and capacity, QC, rework with fault attribution, the bilingual tailor spec sheet, and the lead-time engine.

**Out of scope:** customer-facing order tracking UI (Tier 1) · AI rendering (Tier 3) · courier label generation (Module 12) · payroll.

---

# PART 1 — CORE CONCEPTS

Four ideas that make this module different from ordinary e-commerce inventory. Get these wrong and the rest doesn't work.

### 1.1 Inventory is fabric in metres, not garments in units

There is no finished-goods stock. Nothing exists until an order is placed. What you hold is **cloth**, measured in metres, and each design consumes a known quantity of it.

Store metres as **integer hundredths of a metre** (`450` = 4.50 m). Never floats — the same discipline as money and measurements.

```
available = metersOnHand − metersReserved
```

### 1.2 Dye lots are not interchangeable ⭐

Two rolls of the same fabric from different dye lots differ subtly in colour. Under daylight, a kameez cut from lot A and a trouser from lot B will not match, and the customer will see it.

**Rule: every garment component is cut from a single lot.** Never split one garment across lots. Where a 3-piece suit should match, allocate all its components from the same lot and flag it when that isn't possible.

This is the single most common way apparel inventory systems fail in practice. Most e-commerce stock models have no concept of it.

### 1.3 The fabric lifecycle is driven by order and production events

```
Order reaches DEPOSIT_PAID        →  RESERVE metres from a specific lot
Production stage reaches CUTTING  →  CONSUME (deplete metersOnHand)
Order CANCELLED before cutting    →  RELEASE back to available
Cutting produces offcuts          →  record WASTAGE (actual vs. estimated)
```

Reservation is a promise; consumption is physical. Keep them distinct — a reserved metre is still on the shelf.

### 1.4 Cutting cannot begin before `MEASUREMENTS_CONFIRMED`

A hard gate from the platform's non-negotiables. Once cloth is cut to a customer's measurements it cannot become anyone else's garment. Enforce in the state machine, not the UI.

---

# PART 2 — MODULE 6: FABRIC & INVENTORY

## 2.1 Data model

Module 3 created a minimal `fabrics` table. **Extend it additively** — do not recreate it.

```
fabrics                       -- EXTEND from Module 3
  + reorderPointMeters        -- integer hundredths of a metre
  + reorderQuantityMeters
  + defaultSupplierId
  + isActive

fabric_lots
  id, fabricId
  lotCode                     -- human readable, unique per fabric: "LAWN-BLU-2026-03"
  dyeLotRef                   -- supplier's dye lot reference
  metersReceived
  metersOnHand
  metersReserved
  costPerMeterMinor           -- integer minor units (PKR paisa)
  supplierId, purchaseOrderId
  receivedAt, expiresAt
  colourNotes                 -- observed variance from the master swatch
  swatchAssetId               -- photo of THIS lot, not the generic fabric
  status (AVAILABLE|LOW|DEPLETED|QUARANTINED)

fabric_reservations
  id, orderItemId, fabricLotId
  metersReserved
  status (RESERVED|CONSUMED|RELEASED)
  reservedAt, consumedAt, releasedAt
  actualMetersConsumed        -- set at cutting; drives wastage
  notes

suppliers
  id, name, contactName, phone, email, address
  paymentTerms, leadTimeDays, notes, active

purchase_orders
  id, poNumber, supplierId
  status (DRAFT|SENT|PARTIALLY_RECEIVED|RECEIVED|CANCELLED)
  orderedAt, expectedAt, receivedAt
  totalMinor, notes

purchase_order_lines
  id, purchaseOrderId, fabricId
  metersOrdered, metersReceived
  unitCostMinor

stock_adjustments
  id, fabricLotId
  deltaMeters                 -- signed
  reason (DAMAGE|SAMPLING|COUNT_CORRECTION|CUTTING_WASTE|RETURN|OTHER)
  note, actorId, createdAt    -- APPEND ONLY

trims                         -- buttons, zips, lining, thread — unit-based, simpler
  id, name, type, unit (PIECE|METRE|SPOOL)
  quantityOnHand, quantityReserved
  reorderPoint, costPerUnitMinor, supplierId, active

design_trim_requirements
  designId, trimId, quantityPerGarment
```

## 2.2 Allocation algorithm ⭐

When an order item needs fabric:

```ts
function allocateFabric(input: {
  fabricId: string;
  metersRequired: number;        // hundredths of a metre
  orderItemId: string;
  groupKey?: string;             // components that must match (one garment/suit)
}): AllocationResult {

  // 1. Candidate lots: enough available metres for the WHOLE requirement
  const candidates = lots
    .filter(l => l.fabricId === input.fabricId
              && l.status === 'AVAILABLE'
              && (l.metersOnHand - l.metersReserved) >= input.metersRequired);

  // 2. If this belongs to a match-group already allocated, prefer THAT lot
  const groupLot = existingAllocationForGroup(input.groupKey);
  if (groupLot && isViable(groupLot, input.metersRequired)) return reserve(groupLot);

  // 3. Otherwise FIFO — oldest viable lot first, to avoid dead stock
  const chosen = candidates.sort(byReceivedAtAsc)[0];

  // 4. No single lot can cover it → DO NOT SPLIT. Escalate.
  if (!chosen) return { status: 'INSUFFICIENT', shortfall, candidates };

  return reserve(chosen, input.metersRequired);
}
```

Rules:
- **Never split a garment across lots.** If no single lot suffices, fail loudly and surface it to admin — do not silently split.
- FIFO among viable lots keeps old stock moving.
- A match-group (the components of one suit) always shares a lot where possible; if not, flag for a human decision rather than proceeding.
- Reservations are transactional with the order state change, via the outbox for any notification.

## 2.3 Consumption & wastage

At the CUTTING stage, the cutter records **actual metres used**.

```
wastage = actualMetersConsumed − estimatedMeters(design.fabricConsumptionMeters)
```

- Positive wastage above a threshold raises a flag — either the estimate is wrong or cutting is inefficient. Both are worth knowing.
- Update `design.fabricConsumptionMeters` suggestions from rolling actuals so estimates improve over time.
- `metersOnHand` decrements by the actual, not the estimate.
- Offcuts recorded as a `stock_adjustment` with reason `CUTTING_WASTE`.

## 2.4 Reorder & alerts

- When `available < reorderPointMeters`, emit an alert (outbox → admin notification + dashboard card).
- Suggest a purchase order pre-filled with `reorderQuantityMeters` from the default supplier.
- Account for open POs so you don't reorder twice: `effectiveAvailable = available + metersOnOpenPOs`.

## 2.5 Admin UI

**`/admin/fabrics`** — list with available/reserved/on-hand columns, low-stock highlighted in `--madder`, filter by fabric, supplier, status.

**`/admin/fabrics/[id]`** — master record (Module 3 fields) plus lot list, consumption history, wastage trend, open POs.

**`/admin/fabrics/lots`** — all lots. Columns: lot code, fabric, dye lot ref, on hand, reserved, available, cost/m, received. Per-lot swatch photo (this lot, not the generic fabric). Quarantine action.

**`/admin/fabrics/lots/[id]`** — reservations against this lot, adjustment history, which orders consumed it.

**`/admin/suppliers`** and **`/admin/purchase-orders`** — CRUD, PO lifecycle, partial receiving (receiving a PO line creates a lot).

**`/admin/trims`** — simple unit inventory with reorder points.

All metre values render through `<Measure unit="m">`. All costs through `<Money>`. Every mutation wrapped in `withAudit`.

---

# PART 3 — MODULE 8: PRODUCTION / WORKSHOP

## 3.1 Data model

```
staff                          -- the karigars
  id, name, phone
  role (CUTTER|STITCHER|EMBROIDERER|FINISHER|QC)
  capacityPerWeek              -- garments or jobs; used by the lead-time engine
  isActive, notes
  userId                       -- optional link to a TAILOR login

production_jobs
  id, orderItemId
  stage (MEASUREMENTS_VERIFIED|CUTTING|STITCHING|EMBROIDERY|FINISHING|QC|PACKED)
  assignedToId                 -- staff
  status (PENDING|IN_PROGRESS|BLOCKED|DONE)
  dueAt                        -- derived from the order's promised ship date
  startedAt, completedAt
  blockedReason
  notes

production_job_events          -- append only, via transition()
  jobId, fromStage, toStage, actorId, note, createdAt

qc_checks
  id, jobId, orderItemId
  checklist jsonb              -- {measurements: pass, stitching: pass, finish: fail}
  result (PASS|FAIL)
  photoAssetIds[]
  inspectorId, notes, createdAt

rework_orders
  id, originalOrderItemId, originalJobId
  reason
  faultAttribution (OUR_ERROR|CUSTOMER_MEASUREMENT|FABRIC_DEFECT|UNDETERMINED)
  costMinor                    -- internal cost of redoing
  chargeCustomer (bool)
  status, createdAt, resolvedAt
```

## 3.2 The stage machine

```
MEASUREMENTS_VERIFIED → CUTTING → STITCHING → EMBROIDERY → FINISHING → QC → PACKED
                                                                        ↓ FAIL
                                                                     REWORK → (back to stage)
```

Rules:
- All transitions go through Module 1's **`transition()`**, writing `production_job_events` in the same transaction. Never a raw `UPDATE`.
- **`CUTTING` cannot be entered unless the parent order is at `MEASUREMENTS_CONFIRMED`.** Hard gate.
- Entering `CUTTING` **consumes** the fabric reservation (Part 2.3) in the same transaction.
- `EMBROIDERY` is skippable for designs without embellishment — the stage sequence is per-design, derived from the design's `work` tags.
- A QC `FAIL` creates a `rework_order` and returns the job to the appropriate stage.

## 3.3 The production board

**`/admin/production`** — the screen Shahneela uses daily, standing in the workshop, on a phone.

Requirements:
- Kanban, columns = stages, cards = order items.
- **Touch-first drag to advance.** This is not a desktop-first screen with mobile as an afterthought.
- Card face: order number (mono) · customer first name · design thumbnail · size mode (`M` or `Custom`) · assigned karigar · days to promised ship.
- Cards turn `--madder` when at risk (due date near or passed).
- Filters: stage, karigar, at-risk, garment type, date range — URL-synced via nuqs.
- Tap a card → job detail with the tailor spec sheet, notes, stage history.
- Assign / reassign karigar inline.
- Flag blocked with a reason; blocked cards surface on the dashboard.

**`TAILOR` role sees this route and nothing else** — no prices, no customer contact details, no other admin surface. Enforce server-side (Module 1 RBAC).

## 3.4 The tailor spec sheet ⭐

The physical artifact the workshop works from. `/admin/production/[jobId]/spec` with a print stylesheet.

Contents:
- Order number, design name, colourway, **lot code** (so the cutter takes the right roll)
- **The cut specification** — every measurement from `calculateCutSpec()` (Module 3), in a monospaced table, in inches
- Standard size label *or* "MADE TO MEASURE" prominently
- Customization spec in plain sentences ("boat neck, three-quarter sleeve, chiffon lining")
- Fabric: name, metres allocated, lot code
- Trims required
- Embroidery placement notes + the design render as reference
- Tolerance note: ±0.5″
- Due date

**Bilingual: English and Urdu, side by side.** The karigar may read Urdu more comfortably than English; the spec sheet is where that matters most. Use Noto Naskh Arabic for the Urdu (per Module 1 typography rules — not Nastaliq, which is unreadable in dense tables).

Print-optimised: A4, high contrast, no colour dependence, measurements large enough to read at arm's length on a cutting table.

## 3.5 Capacity & assignment

- Each staff member has `capacityPerWeek`.
- Workload view: jobs assigned per person per week vs. capacity.
- Warn on over-assignment rather than blocking — the workshop knows its own reality better than the model does.
- Suggested assignment: least-loaded qualified person for the stage. A suggestion, never automatic.

## 3.6 QC & rework

- QC checklist configurable per garment type; each item pass/fail with optional photo.
- FAIL → create `rework_order`, capture **fault attribution**.
- **Fault attribution drives money:** `OUR_ERROR` → free remake. `CUSTOMER_MEASUREMENT` → paid alteration, offered as such. This is why Module 3's immutable measurement snapshot matters — it's the evidence.
- Rework cost recorded for margin reporting.

## 3.7 Reporting

- Throughput per stage per week
- Average time in each stage → identifies the bottleneck
- Actual vs. promised lead time
- Rework rate by karigar and by garment type (handle with care — this is people data; surface it as process insight, not a scoreboard)
- Fabric wastage by design

---

# PART 4 — LEAD TIME ENGINE

Made-to-order only works if the promise is honest. This computes the ship date shown at checkout.

```ts
function estimateShipDate(input: {
  garmentType: string;
  sizeMode: 'STANDARD' | 'MADE_TO_MEASURE';
  hasEmbroidery: boolean;
  orderedAt: Date;
}): { estimatedShipDate: Date; confidence: 'HIGH' | 'MEDIUM' | 'LOW' } {

  let days = baseLeadTimeDays(garmentType);           // config per garment type
  if (sizeMode === 'MADE_TO_MEASURE') days += mtmSurchargeDays;
  if (hasEmbroidery) days += embroideryDays;

  // queue depth — how many jobs are ahead of this one
  const queue = openJobsCount();
  const weeklyCapacity = sum(staff.capacityPerWeek);
  days += Math.ceil(queue / weeklyCapacity) * 7;

  // buffer + working days only
  days += bufferDays;
  return { estimatedShipDate: addWorkingDays(orderedAt, days), confidence };
}
```

Requirements:
- Config lives in `/admin/settings/lead-times`: base days per garment type, MTM surcharge, embroidery days, buffer, working days, holidays (Eid, public holidays — significant in Pakistan).
- **Recompute the promise as capacity changes**, but never move a date already promised to a customer. Promised dates are frozen on the order; the estimate only affects *new* orders.
- Surface the current estimate on the dashboard: *"Quoting 18–24 days · 34 jobs in queue."*
- If queue depth pushes the estimate beyond a threshold, alert admin to consider pausing orders or adding capacity. Honesty is the product.

---

# PART 5 — INTEGRATION POINTS (the critical wiring)

| Event | Triggers |
|---|---|
| Order → `DEPOSIT_PAID` | Allocate + reserve fabric per order item; create trim reservations |
| Order → `MEASUREMENTS_CONFIRMED` | Create `production_jobs` for the item's stage sequence; unlock CUTTING |
| Job → `CUTTING` | Consume fabric reservation; decrement `metersOnHand`; record actual metres |
| Job → `QC` FAIL | Create `rework_order`; return job to stage; notify admin |
| Job → `PACKED` | Order item ready; when all items packed → order `READY_TO_SHIP` |
| Order → `CANCELLED` (pre-cutting) | Release all reservations back to available |
| Order → `CANCELLED` (post-cutting) | Reservation stays CONSUMED; deposit forfeit path (Module 7/10) |
| Lot `available < reorderPoint` | Alert + suggested PO |

Every one of these is an **outbox message**, not an inline call. Every one is transactional with the state change that caused it.

---

# PART 6 — BUILD ORDER

### Phase A — Fabric & Inventory

| # | Step | Exit criterion |
|---|---|---|
| 1 | Extend `fabrics`; add lots, reservations, adjustments | Migrations clean; a lot can be created |
| 2 | Suppliers + POs + receiving | Receiving a PO line creates a lot with correct metres and cost |
| 3 | **Allocation algorithm + tests** | Never splits a garment; FIFO among viable lots; insufficient stock escalates |
| 4 | Reserve on `DEPOSIT_PAID` | Placing an order reserves metres; available drops |
| 5 | Release on cancel | Cancelling pre-cutting restores available |
| 6 | Reorder points + alerts | Crossing the threshold produces a dashboard card |
| 7 | Trims inventory | Trim reserved alongside fabric |
| 8 | Admin UI: fabrics, lots, suppliers, POs | Full CRUD, all values via `<Measure>` / `<Money>` |

### Phase B — Production / Workshop

| # | Step | Exit criterion |
|---|---|---|
| 9 | Staff CRUD + roles + capacity | A karigar exists with a weekly capacity |
| 10 | `production_jobs` + stage machine via `transition()` | Illegal transitions throw; events written |
| 11 | **CUTTING gate on `MEASUREMENTS_CONFIRMED`** | Attempting to cut early is refused with a clear message |
| 12 | Fabric consumption on CUTTING | `metersOnHand` decrements by actual; wastage recorded |
| 13 | Production board (touch-first Kanban) | Drag a card on a phone to advance a stage |
| 14 | **Tailor spec sheet (bilingual, printable)** | Prints A4 with the full cut spec, lot code, and Urdu column |
| 15 | QC checklist + photos + rework with fault attribution | A FAIL creates a rework order and returns the job |
| 16 | Capacity view + assignment suggestions | Over-assignment warns, doesn't block |
| 17 | **Lead time engine + settings** | Checkout shows a queue-aware date; promised dates freeze on the order |
| 18 | Reports: throughput, bottleneck, wastage, lead-time accuracy | Each renders from real job data |

**Tier exit criterion:** an order reaches `DEPOSIT_PAID` and reserves 4.5 m from a specific dye lot. Measurements are confirmed, production jobs appear on the board. A cutter opens the bilingual spec sheet on a tablet, cuts from the named lot, records 4.7 m actual — stock decrements, 0.2 m wastage logged. The job moves through stitching and embroidery, fails QC on finishing, generates a rework attributed to `OUR_ERROR`, passes on retry, and reaches PACKED — with every stage change in the audit log, and the fabric never having been split across lots.

---

# PART 7 — TESTING

**Allocation engine — aim for 100%:**
- Never splits a garment across lots
- Match-group components share a lot
- FIFO among viable lots
- Insufficient stock returns `INSUFFICIENT` with shortfall, does not partially reserve
- Reserve → consume → wastage arithmetic
- Release restores exactly the reserved amount
- Concurrent reservations against the same lot don't oversell (transactional test)

**Production:**
- Stage machine allow-list; illegal transitions throw
- CUTTING blocked unless order is `MEASUREMENTS_CONFIRMED`
- CUTTING consumes fabric in the same transaction (rollback test: failure leaves stock untouched)
- QC fail creates rework and returns to the correct stage

**Lead time:**
- Queue depth increases the estimate
- Promised dates on existing orders never change when capacity changes
- Holidays and working days respected

**Playwright:** drag a card across the board on a mobile viewport; print the spec sheet.

---

# PART 8 — NON-NEGOTIABLES

1. Metres stored as **integer hundredths of a metre**. Money as integer minor units. Never floats.
2. **A garment is never cut across two dye lots.** If no single lot suffices, escalate to a human.
3. Reservation and consumption are distinct states. A reserved metre is still on the shelf.
4. **Cutting cannot begin before the order is `MEASUREMENTS_CONFIRMED`.** Enforced in the state machine.
5. Fabric consumption happens in the **same transaction** as the CUTTING stage change.
6. All stage changes go through `transition()`, writing an event row in the same transaction. Never a raw `UPDATE`.
7. Every integration side effect goes through the **outbox**. Never an inline call.
8. `stock_adjustments` and `production_job_events` are **append-only**.
9. The `TAILOR` role sees the production board and nothing else — no prices, no customer contact data. Enforced server-side.
10. The tailor spec sheet is **bilingual** and uses Noto Naskh Arabic (never Nastaliq) for dense Urdu tables.
11. Rework requires **fault attribution** — it determines whether the customer is charged.
12. A promised ship date, once given to a customer, is **frozen** on the order. Capacity changes affect only new quotes.
13. Every admin mutation writes an audit log.
