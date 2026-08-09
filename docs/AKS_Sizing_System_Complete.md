# AKS — THE SIZING SYSTEM
### Complete reference · single source of truth

> **Consolidates:** `AKS_Module3_SizeSystem_Prompt.md` (engine) · `AKS_Design_Upload_End_To_End_Prompt.md` Part 5 (per-design sizing + overlay) · `AKS_Configurator_Cart_Flow_Spec.md` §4–5 (customer flow) — **plus Part 11, the customer-facing 3D size guide, specified here for the first time.**
>
> Where this conflicts with those documents on sizing, **this wins.** They remain authoritative for their own non-sizing content.

This is the system AKS's entire proposition rests on: *"cut for you, not for a chart."* It is also the system most likely to be built wrong, because it looks like a table of numbers and is actually four interlocking mechanisms.

---

# PART 1 — THE MODEL (read before any implementation)

Four distinctions. Get these wrong and everything downstream is wrong.

### 1.1 Body ≠ garment. The difference is ease.

- **Body** — the customer's actual body. Bust 36″.
- **Garment (finished)** — the dimensions of the cut cloth. Chest 40″.
- **Ease** — the 4″ between them.

A tight trouser and a loose trouser fit **the same body**. They differ only in ease.

**Consequence:** you need *one body chart per category* plus *an ease profile per silhouette* — not a separate chart for every silhouette. This single insight collapses what looks like a combinatorial problem into a small one.

### 1.2 Length is a design decision, not a body measurement

A short kurta is 30″ at M; a long dress 44″; a full gown 56″ — same body, same ease. Length lives on the **design**, with its own grade increment.

**Consequence:** never create `SHORT_SHIRT` / `SHIRT` / `LONG_SHIRT` as separate categories. They measure identically. Three categories means maintaining the same ten measurement keys three times, and they *will* drift apart. One `KAMEEZ` category, different LENGTH values.

### 1.3 Measurements do not grade equally

Bust may step +2″ per size while shoulder steps +0.5″ and neck depth barely moves. Real grading is also non-linear at the extremes — bust may go +2″ up to L, then +3″ to XL.

**Consequence:** store a grade increment **per measurement key**, with per-step overrides. Never a flat multiplier across the chart.

### 1.4 Standard and made-to-measure are one system

```
cut spec = body measurements (from a size chart OR from the customer)
         + ease (fit profile)
         + fabric adjustment (shrinkage, stretch)
         + design length spec
```

Only the **first term** changes between a standard size and a bespoke order. Implement one calculator, not two — two code paths guarantee divergence, and divergence shows up as garments that fit differently depending on how they were ordered.

---

# PART 2 — CATEGORIES & MEASUREMENT SETS

A category defines *what gets measured*.

| Category | Measurement keys |
|---|---|
| `KAMEEZ` | BUST, WAIST, HIP, SHOULDER, SLEEVE_LENGTH, SLEEVE_OPENING, ARMHOLE, NECK_DEPTH_FRONT, NECK_DEPTH_BACK, LENGTH |
| `TROUSER` | WAIST, HIP, THIGH, RISE, LENGTH, BOTTOM_OPENING |
| `GOWN` | BUST, WAIST, HIP, SHOULDER, SLEEVE_LENGTH, ARMHOLE, NECK_DEPTH_FRONT, NECK_DEPTH_BACK, LENGTH, SWEEP |
| `SKIRT` | WAIST, HIP, LENGTH, SWEEP |
| `DUPATTA` | LENGTH, WIDTH |

A 3-piece = `KAMEEZ + TROUSER + DUPATTA`, each sized **independently**. A customer can be M on top and L on the bottom — extremely common, and handled badly by most sites.

**Storage:** all measurements as **integer hundredths of an inch** (`3600` = 36.00″). Never floats. Convert at the UI boundary only.

---

# PART 3 — SIZE BLOCKS & THE GRADING ENGINE

A **block** is a reusable size chart for a category.

### 3.1 KAMEEZ default block (base size M)

| Measurement | XS | S | **M** | L | XL | XXL | increment |
|---|---|---|---|---|---|---|---|
| BUST | 32 | 34 | **36** | 38 | 41 | 44 | +2 (+3 from L) |
| WAIST | 28 | 30 | **32** | 34 | 37 | 40 | +2 (+3 from L) |
| HIP | 34 | 36 | **38** | 40 | 43 | 46 | +2 (+3 from L) |
| SHOULDER | 13.5 | 14 | **14.5** | 15 | 15.5 | 16 | +0.5 |
| SLEEVE_LENGTH | 22 | 22.5 | **23** | 23.5 | 24 | 24.5 | +0.5 |
| ARMHOLE | 16 | 16.5 | **17** | 17.5 | 18 | 18.5 | +0.5 |
| LENGTH | 28 | 29 | **30** | 31 | 32 | 33 | +1 |

*(Plausible defaults. Shahneela replaces these with numbers from her actual pattern blocks before any real order.)*

### 3.2 Resolution

```ts
function resolveChart(block, rows, pinned): Grid {
  for (const row of rows) {
    for (const size of block.sizeLabels) {
      const pin = pinned.find(p => p.key === row.key && p.sizeLabel === size);
      if (pin) { grid[row][size] = { value: pin.value, pinned: true }; continue; }

      const steps = index(size) - index(block.baseSizeLabel);
      let value = row.baseValue;
      const dir = Math.sign(steps);
      for (let i = 1; i <= Math.abs(steps); i++) {
        const label = block.sizeLabels[index(block.baseSizeLabel) + i * dir];
        value += (row.gradeOverrides?.[label] ?? row.gradeIncrement) * dir;
      }
      grid[row][size] = { value, pinned: false };
    }
  }
}
```

Per-step accumulation matters: a `+3` override at XL affects the L→XL step only, not the whole run.

### 3.3 Delta propagation ⭐ — the core mechanic

The designer edits the **base-size** cell. LENGTH at M: 30″ → 27″.

```ts
function editBaseCell(row, newValue) {
  const delta = newValue - row.baseValue;
  return { ...row, baseValue: row.baseValue + delta };
  // grade increments untouched → every size shifts by delta
}
```

Result: **25, 26, 27, 28, 29, 30.**

**Use delta (subtraction). Never proportional scaling.** Scaling by 0.9 gives 25.2 / 26.1 / 27 / 27.9 — it corrupts the grading and compounds error at the extremes. Length grades +1″ per size whether the garment is 27″ or 44″.

Write a test literally named `does_not_scale_proportionally`. It exists to assert the *wrong* algorithm isn't used, because proportional scaling looks reasonable.

### 3.4 Pinned cells

Editing a **non-base** cell pins it: it holds its value, is excluded from recomputation, survives later base edits, renders visually distinct, and has a clear unpin action that restores the computed value.

### 3.5 Fork on edit

Designs reference the category's **shared default block**. The first edit **forks a private copy** so editing one design never mutates the shared default.

UI states inheritance explicitly: *"Inheriting KAMEEZ default"* vs *"Customised for this design"*, with revert.

**Without this, thirty designs means thirty hand-maintained charts and the system collapses by design ten.**

### 3.6 Storage rule

**Store only pinned overrides.** Unpinned values are computed on read from `base + Σ(increments)`. Persisting every cell lets computed values drift out of sync with their grade rules — the classic spreadsheet corruption bug.

---

# PART 4 — FIT PROFILES (EASE)

| Profile | Category | Waist ease | Hip ease | Bottom opening | Cling |
|---|---|---|---|---|---|
| Palazzo | TROUSER | +1″ | +8″ | 24″ | 0.30 |
| Loose shalwar | TROUSER | +2″ | +10″ | 16″ | 0.25 |
| Cigarette pant | TROUSER | +0.5″ | +2″ | 12″ | 0.85 |
| Straight kameez | KAMEEZ | +4″ | +4″ | — | 0.40 |
| Fitted gown | GOWN | +1.5″ | +2″ | — | 0.90 |

`clingFactor` (0–1) is how closely the garment follows the body — used by the 3D size guide in Part 11.

---

# PART 5 — FABRIC ADJUSTMENTS

Fabric affects fit in three measurable ways:

- **Stretch %** — reduces required ease. Stretch fabrics may even take negative ease.
- **Shrinkage allowance** — **added to the cut spec** so the finished garment is right *after* washing. Lawn and cotton shrink meaningfully. Omit this and every cotton garment returns a size small after one wash, looking like a tailoring failure.
- **Drape class** (LIGHT / MEDIUM / HEAVY) — affects how loose fits fall and how length reads.

---

# PART 6 — ARCHETYPES / HOUSE MODELS

| Archetype | Height | Bust / Waist / Hip | Wears |
|---|---|---|---|
| Regular (default) | 5'7″ | 36 / 28 / 38 | M |
| Petite | 5'2″ | 34 / 26 / 36 | S |
| Curvy | 5'6″ | 40 / 32 / 44 | L |
| Tall | 5'10″ | 36 / 28 / 38 | M |

**The measurements are authored, never inferred from an image.** You cannot reliably measure a generated photo — no reference object, unknown camera distance, and the model drifts between generations. So you *declare* her measurements and generate to that spec.

Two things depend on this being stored, not guessed:
- The **calibrated overlay** (Part 10) converts inches to pixels using her known height.
- The **drift check** verifies each render's proportions against expected ratios (±5%).

**Licensing (hard rule):** the house model must be an **AI-generated persona**. A real person requires a release explicitly covering AI-derivative works, which standard model releases do not grant. Enforce `isAiGenerated = true`.

**Customer disclosure**, generated from the record:
> *"Model is 5'7″ (170 cm) and wears size M. Bust 36″ · Waist 28″ · Hip 38″"*

---

# PART 7 — CUSTOM SIZE LIMITS

Three layers, server-side as source of truth, client mirroring for instant feedback.

**1. Per-measurement bounds**

| Key | Min | Max |
|---|---|---|
| BUST | 30″ | 52″ |
| WAIST | 22″ | 48″ |
| HIP | 32″ | 56″ |
| SHOULDER | 12″ | 20″ |
| SLEEVE_LENGTH | 0″ | 26″ |
| LENGTH (kameez) | 26″ | 52″ |
| TROUSER_LENGTH | 32″ | 46″ |

**2. Manufacturability** — snap to **0.25″**. You cannot cut to three decimals. Tolerance note: ±0.5″ is normal and not a defect.

**3. Cross-field plausibility** — `HIP >= WAIST`, `SLEEVE_LENGTH <= LENGTH`, ratios within human range. Violations **prompt, not block** (unless physically impossible), in the AKS voice:

> *"A 30″ bust with a 44″ waist is unusual — worth checking the tape once more. We'd rather ask now than take it in later."*

---

# PART 8 — THE CUT-SPEC CALCULATOR

```ts
function calculateCutSpec(input: {
  body: Record<MeasurementKey, number>;   // size chart OR customer's own
  fitProfile: FitProfile;
  fabric: Fabric;
  designLengths: Record<MeasurementKey, number>;
}): CutSpec {
  for (const key of keys) {
    let v = input.body[key];
    let ease = input.fitProfile.easeByMeasurement[key] ?? 0;

    if (input.fabric.stretchPercent > 0)
      ease *= (1 - input.fabric.stretchPercent / 100);
    v += ease;
    v += input.fabric.shrinkageAllowance;

    if (input.designLengths[key] != null)
      v = input.designLengths[key] + input.fabric.shrinkageAllowance;

    spec[key] = roundToStep(v, 25);   // 0.25"
  }
}
```

**One function. Two inputs.** This is where §1.4 becomes code.

---

# PART 9 — ADMIN: THE SIZE CHART EDITOR

`/admin/sizing/blocks/[id]`

Grid: **rows = measurement keys, columns = XS…XXL**, base column highlighted.

- Inline editing. Base cell → shifts the row (delta). Other cell → pins it.
- Pinned cells visually distinct, with unpin.
- `gradeIncrement` editable in its own column; per-step overrides available per cell.
- All values through `<Measure>` (Martian Mono).
- Live recompute as she types. Autosave, optimistic, no per-cell save button.
- Inheritance banner + revert to default.
- Unit toggle (in ↔ cm) at the **display layer only**; storage stays hundredths of an inch.
- Undo/redo for the session.
- **Fit-feedback signals surface here** (Tier 4): *"11 of 34 report shoulders run tight — suggested +0.25″"* with a one-click "apply" that opens a pre-filled delta edit. Suggests, never auto-applies.

---

# PART 10 — ADMIN: THE CALIBRATED OVERLAY

Inside the Design Studio, when the designer adjusts sizing for a specific design.

**The problem:** AI has no ruler. You cannot prompt "make it 27 inches" and get dimensional accuracy — you get *a shorter shirt* at an unpredictable length, and regenerating drifts the face and the embroidery.

**The solution:** don't regenerate. Draw on the existing render.

```ts
const pixelsPerInch = detectSubjectHeight(heroImage) / archetype.heightInches;
const y = anchorY(measurementKey) + (valueInches * pixelsPerInch);
// draw chalk dimension line + Martian Mono numeral at y
```

She sees **exactly** where 27″ lands on the actual photoreal model — mid-thigh, above the knee — instantly, free, with zero identity drift because no pixels are regenerated.

**This is why the archetype's height must be authored** (Part 6). Anchor points per measurement key (shoulder line for LENGTH, waist line for RISE) are calibrated once per archetype.

*Optional Layer 2 — mesh warp.* For deltas within ±3″, deform the image (compress above the hem, tighten the bust silhouette) so she *sees* shape change. Identity is perfectly preserved because you're moving existing pixels. Beyond ±3″ it distorts — fall back to the overlay, which stays exact at any delta. **Build the overlay first; add warp only if asked for.**

**Cost: $0.00 during editing.** One regeneration at apply.

---

# PART 11 — CUSTOMER-FACING: THE 3D SIZE GUIDE ⭐ *(new)*

The gap in the previous documents. This is the storefront size experience.

## 11.1 Why 3D, not AI

The customer asks *"will this fit me, and where?"* A photorealistic image answers that badly — it can't tell her whether the shoulder will pull or where the hem lands on *her*.

More decisively: the requirement is **change the size without changing the dress or the model.** AI cannot guarantee that — six generated sizes give six subtly different faces, six embroidery placements, six drapes. In 3D, identity is guaranteed **by construction**: same mesh, same texture, same camera; only body proportions change, because nothing else is being regenerated.

Plus: instant, free, deterministic, offline-capable, and driven by **the same numbers the tailor cuts from**.

| | AI regeneration | 3D morph |
|---|---|---|
| Same dress & model guaranteed | ✗ drifts | ✓ by construction |
| Latency | ~8s | 16ms |
| Cost per size change | ~$0.08 | $0.00 |
| Dimensionally accurate | ✗ | ✓ |

## 11.2 Fidelity levels — build Level 1

| Level | What | Effort | Verdict |
|---|---|---|---|
| **1** | Clean stylized mannequin, no face, garment as textured mesh, chalk dimension lines | 2–4 weeks with assets | ✅ **Build this.** Delivers the entire functional value, and matches the tailor's-chalk design language. |
| **2** | PBR materials from real fabric photos, studio lighting, soft shadows | +4–6 weeks | Optional polish |
| **3** | Photoreal skin, hair, real cloth simulation | months | ❌ Don't. Heavy on mobile, still won't match an AI photo. This is where the project dies. |

## 11.3 Architecture

**Morph targets (blend shapes).** The mannequin ships with named deformations — `bust+`, `waist+`, `hip+`, `shoulder+`, `height+`. Runtime sets an influence 0–1:

```ts
mesh.morphTargetInfluences[BUST] = normalize(measurements.BUST, range.BUST);
```

Standard glTF, natively supported in three.js / React Three Fiber. Changing a measurement is changing a float — 60fps on a mid-range phone.

**The garment carries two morph sets:**
- *Body-following* — deforms with the body underneath, scaled by the fit profile's `clingFactor`. A fitted gown follows ~90%; a loose shalwar ~30% and holds its own volume. **This is how ease becomes visible.**
- *Design morphs* it owns independently — LENGTH, SLEEVE_LENGTH, BOTTOM_OPENING, NECK_DEPTH.

**No cloth simulation.** Sculpt the states, don't simulate them. Real-time physics cloth in a browser is heavy and fragile, and nobody will notice its absence.

**Dimension lines** use the `<Tape />` motif — chalk line, end caps, Martian Mono numeral. Hovering or focusing a measurement field highlights its span on the model.

## 11.4 Asset procurement ⚠️

The real cost — one-time, not per-request.

Needed: a rigged parametric mannequin with morph targets, plus a garment mesh per category (kameez, trouser, gown) with design morphs.

Options: commission from a 3D artist (**~$500–2,000**) · marketplace purchase with a clean commercial licence · MakeHuman (CC0 output) as a base with morphs sculpted in Blender.

> **⚠️ SMPL / SMPL-X is licensed for research only.** Commercial use requires a paid licence from Max Planck. It is the obvious thing an engineer reaches for and it will quietly poison a commercial project. **Keep it out of the codebase.**

## 11.5 The customer flow

Opens as a **modal over the product page** — never a navigation, so nothing unmounts and no selection resets.

**Standard size mode:** mannequin wearing this design in the selected colourway, morphed to the chosen size. Right panel shows the measurement table **for this garment type**, grouped by component (shirt rows / trouser rows / dupatta rows). Selecting a size morphs the model and highlights the affected span.

**Custom mode:** she enters measurements one at a time; the body morphs live within the Part 7 limits, dimension line highlighting the span in question. **Out-of-range input cannot morph the model, because the limit is enforced in the same place the visual updates** — impossible bodies are unrepresentable, not merely rejected.

**Display body measurements by default** ("fits a bust of 36–38″") — that's what she can measure on herself — with a toggle to finished-garment measurements for women who prefer measuring a garment they already own. Both derive from the same data.

## 11.6 Fallback & performance (required, not optional)

- **Non-3D fallback** — the same options as a plain form with reference photography and the measurement table. Required for accessibility, keyboard operation, screen readers, and low-end devices. Feature-detect WebGL and fall back silently.
- Load the 3D bundle via `next/dynamic({ ssr: false })` — it must never count against the catalog route's JS budget.
- Target: **< 2MB total assets**, 60fps on a mid-range Android. Draco-compress meshes, use KTX2 textures.
- `prefers-reduced-motion` → morph transitions become instant state changes.

## 11.7 Build order

1. Procure/commission mannequin + one garment mesh (longest lead time — **start this first**)
2. R3F canvas + camera + lighting, static pose
3. Body morphs driven by the size chart
4. Garment morphs + `clingFactor`
5. Dimension lines (`<Tape />`) tied to measurement focus
6. Standard-size mode wired to the resolved chart
7. Custom mode wired to limits
8. Non-3D fallback
9. Performance pass to budget

---

# PART 12 — CONSOLIDATED DATA MODEL

```
garment_categories        key, name, nameUr, measurementKeys[], active
measurement_keys          key, label, labelUr, bodyOrGarment, anchorPoint, helpText, demoVideoAssetId

size_blocks               id, name, categoryId, isDefault, ownerDesignId?, sizeLabels[], baseSizeLabel
size_block_rows           blockId, measurementKey, baseValue, gradeIncrement, gradeOverrides jsonb
size_block_cells          blockId, measurementKey, sizeLabel, value, isPinned, editedById, editedAt
                          -- ONLY pinned overrides; unpinned are computed

fit_profiles              id, name, categoryId, easeByMeasurement jsonb, clingFactor, isDefault

house_models              id, name, heightCm, heightInches, bust, waist, hip, shoulder,
                          wearsSizeLabel, buildDescription, identitySeed, referenceAssetIds[],
                          isAiGenerated, active

fabrics                   + stretchPercent, shrinkageAllowance, drapeClass

custom_size_limits        categoryId, measurementKey, minValue, maxValue, step, crossFieldRules jsonb

customer_measurement_profiles   id, userId, label, isDefault, categoryId
customer_measurements           profileId, measurementKey, valueInches

-- 3D assets (Part 11)
mannequin_assets          id, categoryId, glbAssetId, morphTargetMap jsonb, version
garment_meshes            designId?, categoryId, glbAssetId, morphTargetMap jsonb,
                          clingRegions jsonb, version
```

---

# PART 13 — NON-NEGOTIABLES

1. All measurements are **integer hundredths of an inch**. Never floats. Convert at the UI boundary only.
2. Sizing math is **deterministic arithmetic**. AI never computes a measurement — a hallucinated number here is a ruined garment.
3. Grading propagates by **delta**, never proportional scaling.
4. Unpinned cells are **computed, never stored**.
5. Each measurement has its **own** grade increment. Never a flat multiplier.
6. Length variants are **values, not categories**.
7. Standard and made-to-measure use **one cut-spec calculator**. Never two code paths.
8. Shrinkage allowance is always applied to the cut spec.
9. Every value rounds to **0.25″**.
10. Editing a design's chart must never mutate a shared block — **fork on edit**.
11. House model measurements are **authored**, never inferred from an image. `isAiGenerated = true`.
12. The size guide is **3D, not AI-regenerated** — identity must be guaranteed by construction.
13. **SMPL/SMPL-X must not enter the codebase** (research licence only).
14. The 3D guide has a **mandatory non-3D fallback**; it never blocks the purchase.
15. Custom-size limits are enforced **where the visual updates**, so an impossible body cannot render.
16. Fit-feedback signals **suggest, never auto-apply**.
17. `<Measure>` renders every measurement. Every admin mutation writes an audit log.
