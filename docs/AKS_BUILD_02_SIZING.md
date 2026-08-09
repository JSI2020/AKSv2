# AKS BUILD — 02: SIZING ENGINE
### Steps 13–20 · the backbone, part 1

> **Why this comes before catalog:** a design cannot exist without a size chart. Build the engine first, and the catalog simply references it.
>
> **The governing rule for this entire file:** sizing is deterministic arithmetic. **AI never computes a measurement.** A hallucinated number here is a ruined garment, a refund, and a lost customer.
>
> Reference spec: `/docs/AKS_Design_And_Sizing_Unified.md` Part 2.

---

## The four ideas this file implements

Read these before step 13. Every step below depends on them.

**1. Body ≠ garment; the difference is ease.** Body bust 36″, garment chest 40″, ease 4″. A tight trouser and a loose trouser fit the *same body* — they differ only in ease. So: one body chart per category, plus an ease profile per silhouette. Not a chart per silhouette.

**2. Length is a design decision, not a body measurement.** A short kurta is 30″ at M, a long dress 44″. Same body, same ease. Therefore **never create `SHORT_SHIRT` / `LONG_SHIRT` as separate categories** — they measure identically and would drift apart.

**3. Measurements do not grade equally.** Bust may step +2″ per size while shoulder steps +0.5″, and grading is often non-linear at the extremes. Each measurement carries its own increment, with per-step overrides.

**4. Standard and made-to-measure are one system.** `cut spec = body + ease + fabric adjustment + design length`. Only the first term changes. One calculator, never two.

---

## STEP 13 — Categories & measurement keys

**Goal:** define what gets measured, per garment type.

**Prompt:**
> Create Drizzle schema and seed data for `garment_categories` (id, key, name, nameUr, measurementKeys array, active, sortOrder) and `measurement_keys` (key, label, labelUr, bodyOrGarment, anchorPoint, helpText, demoVideoAssetId nullable).
>
> Seed these categories with exactly these measurement key sets:
> - **KAMEEZ**: BUST, WAIST, HIP, SHOULDER, SLEEVE_LENGTH, SLEEVE_OPENING, ARMHOLE, NECK_DEPTH_FRONT, NECK_DEPTH_BACK, LENGTH
> - **TROUSER**: WAIST, HIP, THIGH, RISE, LENGTH, BOTTOM_OPENING
> - **GOWN**: BUST, WAIST, HIP, SHOULDER, SLEEVE_LENGTH, ARMHOLE, NECK_DEPTH_FRONT, NECK_DEPTH_BACK, LENGTH, SWEEP
> - **SKIRT**: WAIST, HIP, LENGTH, SWEEP
> - **DUPATTA**: LENGTH, WIDTH
>
> All measurement values throughout the system are stored as integer hundredths of an inch. Build admin CRUD at `/admin/settings/sizing/categories`.

**Exit:** the five categories exist with correct key sets and are editable in admin.

---

## STEP 14 — Size blocks schema & seed

**Goal:** the standard charts.

**Prompt:**
> Create schema for `size_blocks` (id, name, categoryId, isDefault, ownerDesignId nullable, sizeLabels array, baseSizeLabel, notes, active), `size_block_rows` (id, blockId, measurementKey, baseValue, gradeIncrement, gradeOverrides jsonb, sortOrder), and `size_block_cells` (blockId, measurementKey, sizeLabel, value, isPinned, editedById, editedAt).
>
> **Critical: `size_block_cells` stores ONLY pinned manual overrides.** Unpinned values are computed on read from `baseValue + Σ(increments)` and are never persisted. Persisting every cell would let computed values drift out of sync with their grade rules.
>
> Size labels: XS, S, M, L, XL, XXL. Base size: M.
>
> Seed a default KAMEEZ block with these base values at M and these increments (values in inches, store ×100):
> - BUST base 36, increment +2, override +3 at XL and XXL
> - WAIST base 32, increment +2, override +3 at XL and XXL
> - HIP base 38, increment +2, override +3 at XL and XXL
> - SHOULDER base 14.5, increment +0.5
> - SLEEVE_LENGTH base 23, increment +0.5
> - ARMHOLE base 17, increment +0.5
> - LENGTH base 30, increment +1
>
> Seed reasonable TROUSER and GOWN defaults using the same pattern. Mark the seed as replaceable — these are placeholders until the designer supplies her real pattern-block numbers.

**Exit:** the KAMEEZ block seeds and, when resolved, produces BUST 32/34/36/38/41/44 and LENGTH 28/29/30/31/32/33.

---

## STEP 15 — The grading engine ⭐

**Goal:** the pure arithmetic core. This step has the highest test bar in the project.

**Prompt:**
> Create pure functions in `/modules/sizing/engine` — no I/O, no framework imports.
>
> **`resolveChart(block, rows, pinnedCells)`** returns a grid of measurementKey × sizeLabel. For each cell: if a pinned override exists, use it. Otherwise accumulate step by step from the base size — for each step toward the target size, add `gradeOverrides[thatSizeLabel] ?? gradeIncrement`. Accumulate per step, so an override at XL affects only the L→XL step, not the whole run.
>
> **`editBaseCell(row, newValue)`** computes `delta = newValue - row.baseValue` and returns the row with `baseValue += delta`. Grade increments are untouched, so every size shifts by the same delta.
>
> **This must use delta (subtraction), never proportional scaling.** Editing M LENGTH from 30 to 27 must produce 25/26/27/28/29/30 — not 25.2/26.1/27/27.9. Proportional scaling corrupts grading and compounds error at the extremes.
>
> Write Vitest tests covering: uniform increments; per-step overrides producing non-linear grading; delta propagation preserving increments; pinned cells excluded from recomputation; a test named exactly `does_not_scale_proportionally` asserting the proportional algorithm is not used; and a property test asserting every non-pinned cell always equals `base + Σ(increments)` for any valid block.
>
> Target 100% coverage on this folder.

**Exit:** all tests pass, including `does_not_scale_proportionally` and the property test.

---

## STEP 16 — Size chart editor UI

**Goal:** the screen the designer actually uses.

**Prompt:**
> Build `/admin/settings/sizing/blocks` (list) and `/admin/settings/sizing/blocks/[id]` (editor).
>
> The editor is a grid: rows are measurement keys, columns are XS–XXL, the base size column visually highlighted. There is an additional editable column for `gradeIncrement`. All values render through `<Measure>`.
>
> Editing the base-size cell calls `editBaseCell` and the whole row recomputes live as she types. Autosave optimistically — no per-cell save button. Add undo/redo for the editing session. Add a display-only unit toggle between inches and centimetres; storage always stays integer hundredths of an inch.
>
> Follow the table patterns from `/reference/next-shadcn-dashboard-starter`.

**Exit:** changing M LENGTH from 30 to 27 visibly shifts the whole row to 25/26/27/28/29/30, and the value persists after refresh.

---

## STEP 17 — Pinning, fork-on-edit, revert

**Goal:** manual overrides that survive, and per-design charts that don't corrupt the shared default.

**Prompt:**
> Extend the editor:
>
> **Pinning** — editing any non-base cell writes a `size_block_cells` row with `isPinned = true`. Pinned cells are excluded from recomputation, survive later base-cell edits, render visually distinct, and have an unpin action restoring the computed value.
>
> **Fork on edit** — a design references the category's shared default block by reference. The first edit made in the context of a design forks a private copy with `ownerDesignId` set, so editing one design never mutates the shared default. Show an inheritance banner: "Inheriting KAMEEZ default" versus "Customised for this design", with a "revert to default" action that deletes the fork.
>
> Add tests: a pinned XXL value survives a base-cell edit; forking leaves the shared block byte-identical.

**Exit:** pin XXL LENGTH at 31, then change M LENGTH — XXL stays 31. Fork a chart for a design; the category default is unchanged.

---

## STEP 18 — Fit profiles (ease)

**Goal:** express silhouette without duplicating charts.

**Prompt:**
> Create `fit_profiles` (id, name, categoryId, easeByMeasurement jsonb, clingFactor 0–1, isDefault, notes) with admin CRUD at `/admin/settings/sizing/fit-profiles`.
>
> Seed these (ease values in inches, store ×100):
> - **Palazzo** (TROUSER): waist +1, hip +8, bottom opening 24, cling 0.30
> - **Loose shalwar** (TROUSER): waist +2, hip +10, bottom opening 16, cling 0.25
> - **Cigarette pant** (TROUSER): waist +0.5, hip +2, bottom opening 12, cling 0.85
> - **Straight kameez** (KAMEEZ): waist +4, hip +4, cling 0.40
> - **Fitted gown** (GOWN): waist +1.5, hip +2, cling 0.90
>
> In the editor UI, show the resulting finished-garment measurement beside the body measurement so the effect of ease is legible. `clingFactor` is stored for later use by the storefront 3D size guide and is not used yet.

**Exit:** selecting "Palazzo" against a size M body shows the finished garment measurements with ease applied.

---

## STEP 19 — Fabrics (minimal) & archetypes

**Goal:** fabric properties that affect fit, and the house model whose height calibrates the Design Studio overlay.

**Prompt:**
> **Fabrics** — create `fabrics` (id, name, composition, weightGsm, widthInches, swatchAssetId, careInstructions, drapeNotes, costPerMeterMinor, stretchPercent, shrinkageAllowance, drapeClass LIGHT|MEDIUM|HEAVY, active). Admin CRUD at `/admin/fabrics`. Design the table so a later step can add lots and suppliers additively without altering it. Seed: lawn, chiffon, silk, organza, cotton, khaddar, velvet, net, jamawar, linen — giving lawn and cotton meaningful shrinkage allowances.
>
> **Archetypes** — create `house_models` (id, name, isDefault, active, heightCm, heightInches, bust, waist, hip, shoulder, wearsSizeLabel, buildDescription, identitySeed, referenceAssetIds array, isAiGenerated). Admin CRUD at `/admin/settings/sizing/archetypes`. Seed four:
> - Regular (default): 5'7″, 36/28/38, wears M
> - Petite: 5'2″, 34/26/36, wears S
> - Curvy: 5'6″, 40/32/44, wears L
> - Tall: 5'10″, 36/28/38, wears M
>
> **The measurements are authored, never inferred from an image** — you cannot reliably measure a generated photo, and step 40's calibrated overlay depends on knowing the height exactly.
>
> Enforce `isAiGenerated = true`. A real person's likeness would require a release explicitly covering AI-derivative works, which standard model releases do not grant.
>
> Generate a customer disclosure string from the record: "Model is 5'7″ (170 cm) and wears size M. Bust 36″ · Waist 28″ · Hip 38″"

**Exit:** four archetypes exist; `isAiGenerated = false` cannot be saved; the disclosure string renders correctly.

---

## STEP 20 — Cut-spec calculator ⭐

**Goal:** one function producing the tailor's specification, from either input.

**Prompt:**
> Implement `calculateCutSpec({ body, fitProfile, fabric, designLengths })` in `/modules/sizing/engine`.
>
> For each measurement key: start with the body value. Compute ease from the fit profile; if `fabric.stretchPercent > 0`, reduce ease proportionally. Add ease. Add `fabric.shrinkageAllowance` — the garment is cut larger so it is correct *after* washing. If `designLengths` specifies this key, that value replaces the computed one (still plus shrinkage allowance). Finally round to the nearest 0.25″ — cloth cannot be cut to three decimals.
>
> **`body` accepts either a resolved standard size or a customer's own measurements. There must be exactly one code path** — standard and made-to-measure differ only in this input.
>
> Write tests: standard size input produces a correct spec; custom measurement input produces a correct spec through the identical function; stretch reduces ease; shrinkage increases the cut; every output rounds to 0.25″.

**Exit:** the same function produces a correct cut spec from a size M chart and from a set of custom measurements, with ease and shrinkage applied.

---

## ✅ MILESTONE — SIZING ENGINE COMPLETE

You can define categories, maintain standard charts that regrade correctly, express silhouette through ease, hold archetypes with authored measurements, and produce a tailor-ready cut specification from either a standard size or a customer's own body.

Continue to file 03.

---

## Deferred deliberately

**Custom-size limits** (min/max, cross-field plausibility) are implemented in step 26, where the customer actually enters measurements — the validation belongs next to the input.

**The customer-facing 3D size guide** is a storefront feature. Its specification is in `/docs/AKS_Sizing_System_Complete.md` Part 11. Build it only after step 34, and only if you decide it earns the 3D asset cost.
