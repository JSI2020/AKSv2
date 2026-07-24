# AKS — TIER 1: BECOME A REAL SHOP
### Modules 4 (Catalog) · 9 (Customers) · 7 (Orders) · 10 (Payments) · 12 (Shipping)

> **For:** Cursor · brownfield repo at `C:\Personal\Agentic AI\AKS`
> **Depends on:** Module 1 (Foundation) · Module 3 (Size System) — both complete and demonstrated
> **Companion docs:** `AKS_Complete_Build_Document.md` · `AKS_Configurator_Cart_Flow_Spec.md` (storefront PDP→cart→checkout — **do not duplicate it, implement against it**) · `AKS_Brand_Foundation.md` (voice)
> **Market:** Pakistan only. No multi-currency, no international shipping, no customs.

---

# PART 0 — INSTRUCTION

This is the tier that matters most. At its end, Shahneela can **take and fulfil a real paid order** — with no AI involved anywhere. If the AI catalog never got built, AKS would still be a functioning business after this tier. Everything in Tiers 2–4 is leverage on top of what you build here.

Five modules, in dependency order. Build them sequentially; each has its own exit criterion.

```
4 Catalog → 9 Customers → 7 Orders → 10 Payments → 12 Shipping
                                (+ thin slices: email, policy pages)
```

## 0.1 Before writing code

Confirm Modules 1 and 3 are complete. Then report:
- Which Module 1 primitives you'll use: `transition()`, `withAudit`, outbox, `<Money>`, `<Measure>`, `<DataTable>`, RBAC guards
- The `calculateCutSpec()` and size-block interfaces from Module 3 that Catalog and Orders consume
- Your reconciliation plan for anything already in the repo that conflicts

## 0.2 Two rules that govern the whole tier

**Designs are image-source agnostic.** Module 11 (Design Studio) will later generate imagery with AI. Build the design record so images are simply *assets attached to a colourway and angle* — whether uploaded by hand now or generated later must be invisible to every consumer. Do not build a manual-only model you'll have to rewrite.

**Snapshots are immutable.** When an order is placed, the price, measurements and customization are **copied** onto the order item. Never a live join back to a mutable catalog or profile. This is the difference between winning and losing a dispute three weeks later.

---

# PART 1 — PHASE A: CATALOG (Module 4)

## 1.1 Data model

```
designs
  id, slug (unique), name, nameUr, description, storyCopy
  status (DRAFT|PUBLISHED|ARCHIVED)
  garmentType                      -- FK to Module 3 garment_categories
  components jsonb                 -- e.g. ['KAMEEZ','TROUSER','DUPATTA']
  sizeBlockId                      -- FK Module 3; per component if multi
  fitProfileIds jsonb              -- per component, FK Module 3
  basePriceMinor                   -- integer PKR paisa
  madeToMeasureSurchargeMinor
  fabricConsumptionMeters          -- integer hundredths of a metre
  leadTimeDaysOverride
  featured (bool)                  -- the ONE manual merchandising flag
  publishedAt, archivedAt
  seoTitle, seoDescription, ogAssetId

design_tags                        -- multi-value categorization
  designId, kind (OCCASION|SEASON|WORK|FREE), value

colourways
  id, designId, name, nameUr, slug
  fabricId                         -- FK Module 3 fabrics
  hexApproximation                 -- display fallback only
  priceDeltaMinor                  -- some fabrics cost more
  isDefault, sortOrder, active

design_renders                     -- images, source-agnostic
  id, designId, colourwayId
  angle (FRONT|THREE_QUARTER|BACK|DETAIL)
  archetypeId                      -- FK Module 3 house_models, nullable
  assetId
  isAiGenerated (default false)    -- true when Module 11 produces it
  altText                          -- REQUIRED, accessibility
  sortOrder

customization_options
  id, designId (or categoryId for reusable), key, label, labelUr
  inputType (SELECT|BOOLEAN)
  required, sortOrder

customization_option_values
  id, optionId, value, label, labelUr
  priceDeltaMinor
  referenceAssetId                 -- the photo that explains the term
  sortOrder
```

**Categorization values** (seed these):

| Kind | Values |
|---|---|
| OCCASION | CASUAL · EVERYDAY · FORMAL · SEMI_FORMAL · FESTIVE · PARTY · EVENING · EID · WEDDING_GUEST · MEHNDI · BARAAT · WALIMA · NIKAH · BRIDAL · OFFICE |
| SEASON | SUMMER · WINTER · SPRING · AUTUMN · MID_SEASON · FESTIVE · WEDDING |
| WORK | EMBROIDERED · PRINTED · PLAIN · HAND_EMBELLISHED · ZARI · ZARDOZI · SEQUIN · BLOCK_PRINT · DIGITAL_PRINT · MIRROR_WORK |

## 1.2 Fixed vs. computed categories ⭐

**Fixed attributes** (stored): occasion, garment type, season, work, fabric, price.

**Computed states** (never stored as manual tags — derive them):

| State | Derivation |
|---|---|
| New arrivals | `publishedAt` within a rolling window (30 days) |
| Best sellers | Ranked by **paid** `order_items` count, trailing window. Paid, not placed — refused COD doesn't count |
| Back in stock | Fabric lot crossed from zero to positive available |
| Sale | An active discount rule exists (Tier 4) |
| Last chance | Remaining fabric metres below threshold — computed honestly from real stock |
| Ready to ship vs. made-to-order | From lead-time rules and fabric availability |

Expose these as **system collections** via views or cached queries, refreshed on a schedule. If you find yourself adding a "mark as best seller" checkbox to the admin, stop — that's the bug.

The single legitimate manual flag is `featured` ("Shahneela's picks").

## 1.3 Pricing engine

```
unitPrice = basePrice
          + colourwayPriceDelta
          + Σ(customizationOptionDeltas)
          + (sizeMode === 'MADE_TO_MEASURE' ? madeToMeasureSurcharge : 0)
```

**Computed server-side, always.** Never trust a client-supplied price. Snapshot the full breakdown onto the order item at placement (Phase C).

## 1.4 Admin UI

- **`/admin/designs`** — list, search, filter by status/occasion/season/fabric, bulk actions (publish, archive, tag, price adjust), duplicate, CSV import/export.
- **`/admin/designs/[id]`** — tabbed: Details · Media · Colourways · Pricing · Sizing · Customization · SEO. Manual image upload per colourway × angle, drag to reorder, set primary, **alt text required before publish**.
- **Publish checklist** (blocking, shown as a checklist not an error): ≥1 colourway · ≥1 render per colourway · alt text on all · base price · fabric consumption · size block assigned · fit profile per component · ≥1 occasion tag.

## 1.5 Storefront data layer

Build the query layer the storefront consumes (UI per `AKS_Configurator_Cart_Flow_Spec.md`):
- `getPublishedDesigns(filters, sort, page)` — faceted, indexed
- `getDesignBySlug(slug)` with colourways, renders, options, size chart
- `resolveImages(designId, colourwayId)` → `{ FRONT, THREE_QUARTER, BACK }` — **this is the colour-swap resolver**; it reads cached rows only, never generates
- `resolveCollection(slug)` — knows whether a slug is an attribute filter or a computed system collection

**Phase A exit:** a design with two colourways, three angles each, correct pricing and size chart is published and renders on the storefront with instant colour switching.

---

# PART 2 — PHASE B: CUSTOMERS (Module 9)

## 2.1 Data model

Extends Module 1's `users` (role `CUSTOMER`). Do not create a parallel table.

```
customer_profiles
  userId (PK)
  whatsappNumber                   -- separate from phone; this is the primary channel
  codRefusalCount (default 0)
  codDisabled (bool)
  totalOrdersCount, lifetimeValueMinor
  tags[], internalNotes
  acceptsMarketing, source

addresses                          -- PAKISTANI FORMAT
  id, userId
  label                            -- 'Home', 'Office'
  recipientName, phone
  addressLine1                     -- house/flat, street
  addressLine2                     -- area, block, sector
  city, province                   -- Punjab|Sindh|KPK|Balochistan|GB|AJK|ICT
  postalCode                       -- OPTIONAL — not universally used
  landmark                         -- genuinely useful for delivery in Pakistan
  isDefaultShipping
  deletedAt

customer_measurement_profiles      -- links Module 3
  id, userId, label, isDefault
  categoryId
  -- measurement values in a child table, integer hundredths of an inch
  createdAt, updatedAt

customer_measurements
  profileId, measurementKey, valueInches
```

**Address form is Pakistani, not Western.** Province is a select; postal code is optional; `landmark` is a real field because that is how addresses work in practice. Do not build a postcode-lookup-centric form.

## 2.2 Guest and account

- Orders can be placed as a guest — no account required. Capture name, phone, WhatsApp, address.
- After purchase, offer account creation (never as a gate before it).
- **Guest → account merge:** when a guest signs up with an email matching prior guest orders, link those orders after email verification. Never merge on unverified email.

## 2.3 COD risk control

Increment `codRefusalCount` when an order reaches `DELIVERY_REFUSED`. At `>= 1`, set `codDisabled` and require prepayment on future orders. Surface prominently on the customer record and at checkout (in the AKS voice, not as an accusation).

## 2.4 Admin UI

`/admin/customers` — list, search by name/phone/WhatsApp/email, filters (has orders, COD disabled, tagged). Detail: contact, addresses, saved measurement profiles (editable **with audit trail** — this is dispute evidence), order history, LTV, notes, communication log, blocklist, data export and account deletion.

**Phase B exit:** a guest places an order; the customer record exists with a Pakistani address; a later signup with the same verified email links the order history.

---

# PART 3 — PHASE C: ORDERS (Module 7) ⭐ the spine

## 3.1 Data model

```
carts
  id, userId?, anonId                -- httpOnly cookie for guests
  status (ACTIVE|CONVERTED|ABANDONED)
  expiresAt

cart_lines
  id, cartId, designId, colourwayId
  sizeMode (STANDARD|MADE_TO_MEASURE)
  sizeLabel?, measurementProfileId?
  customizationSelections jsonb
  unitPriceMinor                     -- computed server-side at add time
  quantity

orders
  id, orderNumber                    -- 'AKS-2026-00042'
  userId?, guestEmail?, guestPhone?, whatsappNumber
  status                             -- see 3.2
  currency 'PKR'
  subtotalMinor, discountMinor, shippingMinor, taxMinor, totalMinor
  depositAmountMinor, balanceAmountMinor
  paymentPlan (FULL_PREPAID|DEPOSIT_50_COD_50|DEPOSIT_70_COD_30)
  promisedShipDate                   -- FROZEN once given
  shippingAddressSnapshot jsonb      -- copy, not FK
  customerNotes, internalNotes
  source (WEB|WHATSAPP|INSTAGRAM|PHONE|WALK_IN)
  placedAt, cancelledAt, cancelReason

order_items
  id, orderId, designId, colourwayId
  designSnapshot jsonb               -- name, images, slug at time of order
  sizeMode, sizeLabel?
  measurementSnapshot jsonb          -- IMMUTABLE COPY, never an FK
  customizationSnapshot jsonb        -- IMMUTABLE
  priceBreakdownSnapshot jsonb       -- base + deltas + surcharge, itemised
  unitPriceMinor, quantity, lineTotalMinor
  cutSpecSnapshot jsonb              -- from Module 3 calculateCutSpec()

order_events                         -- APPEND ONLY, via transition()
  orderId, fromStatus, toStatus, actorId, note, createdAt
```

**Every `*Snapshot` is a frozen copy.** If the customer later edits her measurement profile or Shahneela changes a price, this order must not change.

## 3.2 Order state machine

```
DRAFT → AWAITING_DEPOSIT → DEPOSIT_PAID → MEASUREMENTS_CONFIRMED
      → IN_PRODUCTION → QUALITY_CHECK → READY_TO_SHIP → DISPATCHED
      → DELIVERED → COMPLETED

exits: CANCELLED (only before MEASUREMENTS_CONFIRMED)
       REFUND_PENDING → REFUNDED
       DELIVERY_REFUSED → WRITE_OFF
```

Rules:
- All transitions via Module 1's **`transition()`**, writing `order_events` in the same transaction.
- **Cancellation after `MEASUREMENTS_CONFIRMED` forfeits the deposit** and requires explicit acknowledgement with a reason.
- `DEPOSIT_PAID` emits the fabric-reservation event (consumed by Tier 2; a no-op outbox topic until then).
- `MEASUREMENTS_CONFIRMED` is the gate that releases production.

## 3.3 Cart → order

- Cart lives **server-side** against `anonId` (httpOnly cookie) for guests; merges into the user's cart on sign-in. Never a browser-storage-only cart.
- Add-to-cart snapshots the configurator state (per the Configurator spec §6) and computes price server-side.
- At checkout, re-validate: design still published, price unchanged, fabric plausibly available. If anything changed, tell her plainly before payment.

## 3.4 Manual / draft order creation ⭐

**Do not treat this as optional.** In this market a large share of sales arrive by WhatsApp and Instagram DM. If Shahneela cannot enter those orders here, she will run them in a notebook and your data will be fiction.

`/admin/orders/new`: pick or create a customer → add items (design, colourway, size or custom measurements) → adjust price with a reason → set payment plan → record deposit received (bank transfer, cash, wallet) → place. Sets `source` accordingly. Same state machine, same snapshots, same production flow.

## 3.5 Admin UI

- **`/admin/orders`** — list with filters (status, payment state, date, customer, size mode, at-risk, source), saved views, bulk actions.
- **`/admin/orders/[id]`** — items with the **immutable measurement snapshot** displayed, price breakdown, payment status, event timeline, customer vs. internal notes.
  Actions: confirm measurements · advance stage · record payment · refund · cancel with reason · edit before production lock · split/partial dispatch.
  Prints: **invoice**, **packing slip**, tailor spec sheet (Tier 2).
- **Guest tracking** — `/track/[orderNumber]` gated by email or WhatsApp OTP.

## 3.6 Thin slices required here

- **Transactional email** via Resend, through the outbox: order placed, deposit received, measurements needed, dispatched, delivered. Templated, versioned, in the AKS voice.
- **Policy pages** — terms, privacy, returns/bespoke, shipping. ⚠️ **Payment gateway onboarding requires live, visible policy pages**, so this blocks Phase D. Build simple CMS-backed static pages now.

**Phase C exit:** a guest completes checkout, an order exists with frozen snapshots and a human-readable number, the state machine refuses an illegal transition, a confirmation email arrives, and Shahneela can create the same order manually from a WhatsApp conversation.

---

# PART 4 — PHASE D: PAYMENTS (Module 10)

## 4.1 The constraint

**Stripe does not support Pakistani merchants.** Never architect around it. Build the interface first, adapters behind it.

```ts
interface PaymentProvider {
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  verifyWebhook(raw: string, sig: string): WebhookEvent;
  refund(input: RefundInput): Promise<RefundResult>;
  getStatus(providerRef: string): Promise<PaymentStatus>;
}
```

Adapters: **Safepay** (primary — best DX), **JazzCash / Easypaisa** (wallets), **BankTransferProvider** (manual verification), **CashOnDelivery** (courier-collected). No provider SDK imported outside its adapter.

## 4.2 Data model

```
payments
  id, orderId
  provider (SAFEPAY|JAZZCASH|EASYPAISA|BANK_TRANSFER|COD|CASH)
  providerRef
  kind (DEPOSIT|BALANCE|FULL|REFUND)
  amountMinor, currency 'PKR'
  status (PENDING|SUCCEEDED|FAILED|REFUNDED|AWAITING_VERIFICATION)
  rawPayload jsonb
  idempotencyKey                     -- UNIQUE
  receiptAssetId                     -- bank transfer proof
  verifiedById, verifiedAt
  createdAt

refunds
  id, paymentId, orderId, amountMinor
  reason, status, providerRef, actorId

cod_remittances                      -- courier settlement reconciliation
  id, courier, remittanceRef
  expectedAmountMinor, receivedAmountMinor
  receivedAt, orderIds[], discrepancyNote
```

## 4.3 Payment plans ⭐

The rule that protects you, derived from the economics: a made-to-measure garment cut to one customer's body **cannot be resold**. A standard size can.

| Size mode | Plan |
|---|---|
| STANDARD | 50% deposit + 50% COD permitted |
| MADE_TO_MEASURE | **70% deposit minimum, or full prepaid** |
| COD disabled customer | Full prepaid, any size mode |

- **Deposit becomes non-refundable once cutting begins** (`MEASUREMENTS_CONFIRMED` → production). Stated plainly at checkout and acknowledged explicitly — never a buried clause.
- Balance captured at `DELIVERED` for COD, or before `DISPATCHED` for prepaid.

## 4.4 Bank transfer (build this properly — it's heavily used)

Customer selects bank transfer → sees account details and the order number as reference → uploads a receipt image → order sits at `AWAITING_VERIFICATION`. Admin queue at `/admin/payments/verification`: receipt image beside the expected amount, one-click verify or reject with reason. Verification transitions the order and emits the outbox event.

## 4.5 COD reconciliation

Couriers remit COD collections in batches, typically 7–14 days later. Build:
- Import or manually enter a remittance (courier, reference, amount, order list)
- Match against delivered orders; flag discrepancies
- Outstanding COD report — **this is real cash-flow exposure**, surface it on the dashboard

## 4.6 Webhooks

Route handlers verify signature → dedupe on `idempotencyKey` → record raw payload → transition the order → emit outbox. **Idempotent:** the same webhook delivered five times must produce one payment row and one transition. Test this explicitly.

**Phase D exit:** a customer pays a 50% deposit via Safepay, the webhook transitions the order to `DEPOSIT_PAID` exactly once even when replayed; a second customer pays by bank transfer and is verified from the admin queue; a made-to-measure order refuses a 50/50 plan.

---

# PART 5 — PHASE E: SHIPPING (Module 12)

Pakistan only. Far simpler than the original international scope.

## 5.1 Data model

```
couriers
  id, name (TCS|LEOPARDS|MP|OTHER)
  supportsCod, apiCredentialsRef, active

shipping_rates
  id, courierId
  ruleType (FLAT|CITY_TIER|WEIGHT|FREE_OVER)
  cityTier (TIER_1|TIER_2|REST)      -- Karachi/Lahore/Islamabad vs. rest
  minWeightGrams, maxWeightGrams
  amountMinor, freeOverMinor

shipments
  id, orderId, courierId
  trackingNumber, labelAssetId
  isCod, codAmountMinor
  status (PENDING|DISPATCHED|IN_TRANSIT|DELIVERED|FAILED|RETURNED)
  dispatchedAt, deliveredAt, failureReason

alteration_requests
  id, orderId, orderItemId
  reason, faultAttribution (OUR_ERROR|CUSTOMER_MEASUREMENT|UNDETERMINED)
  chargeMinor, status, notes
```

## 5.2 Behaviour

- **Rates:** flat or city-tier is enough at launch. Tier 1 cities (Karachi, Lahore, Islamabad/Rawalpindi) vs. rest of Pakistan. Free-over-threshold optional.
- **Dispatch:** create shipment, record tracking number, transition order to `DISPATCHED`, emit customer notification (email + WhatsApp later).
- **COD flag** passes the balance amount to the courier.
- **Delivery exceptions:** failed delivery, refused (→ `DELIVERY_REFUSED`, increments `codRefusalCount`), returned to sender.
- **Alterations:** intake with fault attribution — free if our error, charged if her measurements. Bespoke goods are exempt from standard return rights; disclose this clearly at checkout rather than relying on it silently.
- Courier API integration is optional at launch: manual tracking-number entry is acceptable and faster to ship.

**Phase E exit:** an order is dispatched with a tracking number, the customer is notified, and a refused delivery correctly flags the customer's COD status.

---

# PART 6 — BUILD ORDER & EXIT CRITERIA

| Phase | Module | Exit criterion |
|---|---|---|
| A | Catalog | Published design with 2 colourways × 3 angles, correct pricing, renders on storefront with instant colour swap |
| B | Customers | Guest order creates a customer with a Pakistani address; verified signup links prior orders |
| C | Orders | Guest checkout produces an order with frozen snapshots; illegal transition throws; confirmation email sent; manual WhatsApp order works |
| D | Payments | Safepay deposit transitions the order once under webhook replay; bank transfer verified from admin; MTM refuses 50/50 |
| E | Shipping | Dispatch with tracking; refusal flags COD |

**TIER EXIT CRITERION — the milestone that matters:**

> A customer browses the storefront, filters by occasion, opens a design, switches colour instantly, picks size M, adds to cart, checks out as a guest with a Pakistani address, pays a 50% deposit via Safepay, and receives a confirmation email. Shahneela sees the order in admin with the immutable price and measurement snapshot, confirms measurements, marks it dispatched with a tracking number, and records the COD balance on delivery. The order reaches `COMPLETED`, every transition is in the audit log, and **no AI was involved at any point.**

At that moment AKS is a real business.

---

# PART 7 — TESTING

**Critical paths (aim for 100%):**
- Pricing engine: base + colourway + options + MTM surcharge, server-side only
- Order state machine: allow-list, illegal transitions throw, events written transactionally
- Snapshot immutability: editing a design price or a measurement profile does not alter an existing order
- Payment webhook idempotency: 5× delivery → 1 payment, 1 transition
- Payment plan rules: MTM cannot select 50/50; COD-disabled customer cannot select COD
- Deposit forfeit logic on post-`MEASUREMENTS_CONFIRMED` cancellation
- Cart merge on sign-in doesn't duplicate lines

**Playwright:** full guest checkout on a mobile viewport, throttled; admin manual order creation; bank-transfer verification flow.

**axe-core** on every new route.

---

# PART 8 — NON-NEGOTIABLES

1. Money is **integer minor units (PKR paisa)**. Measurements are integer hundredths of an inch. Metres are integer hundredths. **Never floats.**
2. Prices are computed **server-side**. A client-supplied price is never trusted.
3. Measurement, customization, price and address **snapshots on orders are immutable copies**, never foreign keys to mutable records.
4. Order state changes only through `transition()`, writing an event row in the same transaction. Never a raw `UPDATE`.
5. **Stripe does not support Pakistani merchants.** Safepay/JazzCash/Easypaisa/bank transfer behind the `PaymentProvider` interface. No provider SDK outside its adapter.
6. Payment webhooks are **idempotent** — unique `idempotencyKey`, replay-safe.
7. Made-to-measure requires **≥70% deposit or full prepaid**. 50/50 COD is for standard sizes only.
8. Deposit is non-refundable once cutting begins, **disclosed plainly and acknowledged explicitly** at checkout.
9. Cart is **server-side**, keyed by httpOnly `anonId` for guests. Never browser-storage-only.
10. **Manual order creation is a first-class feature**, not an afterthought.
11. Addresses use the **Pakistani format** — province select, optional postal code, landmark field.
12. Computed collections (new, best-selling, sale, back-in-stock) are **derived, never manually tagged**.
13. `<Money>` renders every price, `<Measure>` every measurement, alt text required on every render before publish.
14. Every external side effect goes through the **outbox**. Every admin mutation writes an audit log.
15. Policy pages must be live before payment-gateway onboarding — treat as a Phase C deliverable, not a nicety.
