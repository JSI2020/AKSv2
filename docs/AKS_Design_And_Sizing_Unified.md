# AKS — DESIGN CREATION & SIZING
### Unified end-to-end implementation prompt

> **For:** Cursor · brownfield repo at `C:\Personal\Agentic AI\AKS`
> **Supersedes:** `AKS_Design_Upload_End_To_End_Prompt.md` and `AKS_Sizing_System_Complete.md` — this document merges both and removes the overlap between them. Where either of those conflicts with this, **this wins.**
> **Depends on:** Module 1 (Foundation & Access) — auth, RBAC, audit log, `transition()`, outbox, design tokens, primitives.
> **Out of scope, deliberately:** the **customer-facing 3D size guide**. It is a storefront feature, not part of the admin design flow. Its spec lives in `AKS_Sizing_System_Complete.md` Part 11; build it with the storefront, not here. Everything in this document is admin-side.

---

# PART 0 — INSTRUCTION

You are building two interlocking systems:

1. **The sizing engine** — categories, measurement sets, standard size charts, grading, ease, archetypes, and the cut specification the tailor works from.
2. **The Design Studio** — the admin flow that turns a paper sketch into a published, photorealistic, correctly-sized product.

They are one document because they are one workflow: a design cannot be published without sizing, and sizing has no meaning without a design. Build **Part 2 first** (the engine), then Parts 4–10 (the flow that consumes it).

Three principles govern every decision:

1. **Deterministic where it matters.** Sizing is arithmetic, never AI. A hallucinated measurement is not a bad paragraph — it is a ruined garment, a refund, and a lost customer.
2. **Generate once, derive many.** The AI runs at defined gates, never on every interaction. Everything downstream references a locked master image.
3. **Nothing reaches a customer without a human gate.** Shahneela approves; the system never auto-publishes.

## 0.1 Survey first — brownfield

This repo was started in Cursor. Before writing code, produce a written report: existing stack and dependencies, what is scaffolded vs. stubbed, schema state, and any conflict with Part 11's fixed stack (wrong ORM, floats for money, missing TypeScript strict). Propose a reconciliation plan. **Do not scaffold over existing work, delete files, or run migrations in this pass.** Report and wait.

Then confirm Module 1's exit criterion is met and list which of its primitives you will use: `transition()`, `withAudit`, the outbox, `<Measure>`, `<Money>`, `<Tape>`, `<DataTable>`, RBAC guards.

---

# PART 1 — THE SIZING MODEL (read before implementing anything)

Four distinctions. Get these wrong and everything downstream is wrong.

### 1.1 Body ≠ garment. The difference is ease.

- **Body** — the customer's actual body. Bust 36″.
- **Garment (finished)** — the dimensions of the cut cloth. Chest 40″.
- **Ease** — the 4″ between them.

A tight trouser and a loose trouser fit **the same body**; they differ only in ease.

**Consequence:** one body chart per category plus an ease profile per silhouette — not a chart per silhouette. This collapses what looks like a combinatorial problem into a small one.

### 1.2 Length is a design decision, not a body measurement

A short kurta is 30″ at M; a long dress 44″; a full gown 56″ — same body, same ease.

**Consequence:** never create `SHORT_SHIRT` / `SHIRT` / `LONG_SHIRT` as separate categories. They measure identically. Three categories means maintaining the same ten measurement keys three times, and they *will* drift. One `KAMEEZ` category, different LENGTH values.

### 1.3 Measurements do not grade equally

Bust may step +2″ per size while shoulder steps +0.5″. Real grading is also non-linear at the extremes (+2″ up to L, then +3″ to XL).

**Consequence:** a grade increment **per measurement key**, with per-step overrides. Never a flat multiplier.

### 1.4 Standard and made-to-measure are one system

```
cut spec = body measurements (from a size chart OR from the customer)
         + ease (fit profile)
         + fabric adjustment (shrinkage, stretch)
         + design length spec
```

Only the **first term** changes. Implement one calculator, not two — two code paths guarantee divergence, and divergence shows up as garments that fit differently depending on how they were ordered.

---

# PART 2 — THE SIZING ENGINE (build first)

Everything here is configured once and reused by every design.

## 2.1 Categories & measurement sets

| Category | Measurement keys |
|---|---|
| `KAMEEZ` | BUST, WAIST, HIP, SHOULDER, SLEEVE_LENGTH, SLEEVE_OPENING, ARMHOLE, NECK_DEPTH_FRONT, NECK_DEPTH_BACK, LENGTH |
| `TROUSER` | WAIST, HIP, THIGH, RISE, LENGTH, BOTTOM_OPENING |
| `GOWN` | BUST, WAIST, HIP, SHOULDER, SLEEVE_LENGTH, ARMHOLE, NECK_DEPTH_FRONT, NECK_DEPTH_BACK, LENGTH, SWEEP |
| `SKIRT` | WAIST, HIP, LENGTH, SWEEP |
| `DUPATTA` | LENGTH, WIDTH |

A 3-piece = `KAMEEZ + TROUSER + DUPATTA`, each sized **independently**. A customer can be M on top and L on the bottom — common, and handled badly by most sites.

**Storage:** measurements as **integer hundredths of an inch** (`3600` = 36.00″). Metres as integer hundredths. Money as integer minor units (PKR paisa). **Never floats.** Convert at the UI boundary only.

## 2.2 Size blocks — the standard charts

**KAMEEZ default block** (base size M):

| Measurement | XS | S | **M** | L | XL | XXL | increment |
|---|---|---|---|---|---|---|---|
| BUST | 32 | 34 | **36** | 38 | 41 | 44 | +2 (+3 from L) |
| WAIST | 28 | 30 | **32** | 34 | 37 | 40 | +2 (+3 from L) |
| HIP | 34 | 36 | **38** | 40 | 43 | 46 | +2 (+3 from L) |
| SHOULDER | 13.5 | 14 | **14.5** | 15 | 15.5 | 16 | +0.5 |
| SLEEVE_LENGTH | 22 | 22.5 | **23** | 23.5 | 24 | 24.5 | +0.5 |
| ARMHOLE | 16 | 16.5 | **17** | 17.5 | 18 | 18.5 | +0.5 |
| LENGTH | 28 | 29 | **30** | 31 | 32 | 33 | +1 |

*Plausible defaults. Shahneela replaces these with numbers from her actual pattern blocks before any real order.*

Sizes: `XS, S, M, L, XL, XXL`.

## 2.3 The grading engine

Pure functions in `modules/sizing/engine/`. No I/O, no framework. Fully unit tested.

**Resolve a chart:**

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

**Delta propagation ⭐ — the core mechanic.** The designer edits the **base-size** cell. LENGTH at M: 30″ → 27″.

```ts
function editBaseCell(row, newValue) {
  const delta = newValue - row.baseValue;
  return { ...row, baseValue: row.baseValue + delta };
  // grade increments untouched → every size shifts by delta
}
```

Result: **25, 26, 27, 28, 29, 30.**

> **Use delta (subtraction). Never proportional scaling.** Scaling by 0.9 gives 25.2 / 26.1 / 27 / 27.9 — it corrupts grading and compounds error at the extremes. Length grades +1″ per size whether the garment is 27″ or 44″.

Write a test literally named `does_not_scale_proportionally`. It exists to assert the *wrong* algorithm isn't used, because proportional scaling looks reasonable.

**Pinned cells.** Editing a **non-base** cell pins it: it holds its value, is excluded from recomputation, survives later base edits, renders visually distinct, and has a clear unpin action restoring the computed value.

**Fork on edit.** Designs reference the category's **shared default block**. The first edit **forks a private copy** (`ownerDesignId` set) so editing one design never mutates the shared default. UI states inheritance explicitly — *"Inheriting KAMEEZ default"* vs *"Customised for this design"* — with revert.

> Without fork-on-edit, thirty designs means thirty hand-maintained charts and the system collapses by design ten.

**Editable grade increments.** She can edit the *step*, not only the base value — "this floor-length gown grades +2″ per size." Expose `gradeIncrement` as an editable column.

**Storage rule.** Store **only pinned overrides**. Unpinned values are computed on read from `base + Σ(increments)`. Persisting every cell lets computed values drift out of sync with their grade rules — the classic spreadsheet corruption bug.

## 2.4 Fit profiles (ease)

| Profile | Category | Waist ease | Hip ease | Bottom opening | Cling |
|---|---|---|---|---|---|
| Palazzo | TROUSER | +1″ | +8″ | 24″ | 0.30 |
| Loose shalwar | TROUSER | +2″ | +10″ | 16″ | 0.25 |
| Cigarette pant | TROUSER | +0.5″ | +2″ | 12″ | 0.85 |
| Straight kameez | KAMEEZ | +4″ | +4″ | — | 0.40 |
| Fitted gown | GOWN | +1.5″ | +2″ | — | 0.90 |

`clingFactor` (0–1) is consumed by the storefront 3D guide (out of scope here); store it now.

## 2.5 Fabrics — fit-affecting properties

Minimal record here; Tier 2 extends it with lots, suppliers and purchase orders. **Design the table so that extension is additive.**

- **stretchPercent** — reduces required ease.
- **shrinkageAllowance** — **added to the cut spec** so the finished garment is right *after* washing. Lawn and cotton shrink meaningfully. Omit this and every cotton garment returns a size small after one wash, looking like a tailoring failure.
- **drapeClass** (LIGHT / MEDIUM / HEAVY).

Seed: lawn, chiffon, silk, organza, cotton, khaddar, velvet, net, jamawar, linen — with plausible values.

## 2.6 House models (archetypes) ⭐

| Archetype | Height | Bust / Waist / Hip | Wears |
|---|---|---|---|
| Regular (default) | 5'7″ | 36 / 28 / 38 | M |
| Petite | 5'2″ | 34 / 26 / 36 | S |
| Curvy | 5'6″ | 40 / 32 / 44 | L |
| Tall | 5'10″ | 36 / 28 / 38 | M |

**The measurements are authored, never inferred from an image.** You cannot reliably measure a generated photo — no reference object, unknown camera distance, and the model drifts between generations. You *declare* her measurements and generate to that spec.

Two things depend on this being stored, not guessed:
- The **calibrated overlay** (Part 7.4) converts inches to pixels using her known height.
- The **drift check** verifies each render's proportions against expected ratios (±5%).

**Identity locking:** every render passes `identitySeed` + `referenceAssetIds` so the same face and body appear across all designs. This is what makes the catalog look like one brand.

**Licensing (hard rule):** the house model must be an **AI-generated persona**. A real person requires a release explicitly covering AI-derivative works, which standard model releases do not grant. Enforce `isAiGenerated = true`.

**Customer disclosure**, generated from the record:
> *"Model is 5'7″ (170 cm) and wears size M. Bust 36″ · Waist 28″ · Hip 38″"*

## 2.7 Custom size limits

Three layers. Server-side is the source of truth; the client mirrors for instant feedback.

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

**2. Manufacturability** — snap to **0.25″**. You cannot cut to three decimals. Tolerance: ±0.5″ is normal and not a defect.

**3. Cross-field plausibility** — `HIP >= WAIST`, `SLEEVE_LENGTH <= LENGTH`, ratios within human range. Violations **prompt, not block** (unless physically impossible), in the AKS voice:

> *"A 30″ bust with a 44″ waist is unusual — worth checking the tape once more. We'd rather ask now than take it in later."*

## 2.8 The cut-spec calculator

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
    v += input.fabric.shrinkageAllowance;      // cut LARGER; shrinks to correct

    if (input.designLengths[key] != null)
      v = input.designLengths[key] + input.fabric.shrinkageAllowance;

    spec[key] = roundToStep(v, 25);            // 0.25"
  }
}
```

**One function. Two inputs.** This is where §1.4 becomes code.

## 2.9 Admin: the size chart editor

`/admin/sizing/blocks/[id]` — the centrepiece.

Grid: **rows = measurement keys, columns = XS…XXL**, base column highlighted.

- Inline editing. Base cell → shifts the row (delta). Other cell → pins it.
- Pinned cells visually distinct, with unpin.
- `gradeIncrement` editable in its own column; per-step overrides available per cell.
- All values through `<Measure>` (Martian Mono).
- Live recompute as she types. Autosave, optimistic, no per-cell save button.
- Inheritance banner + revert to default.
- Unit toggle (in ↔ cm) at the **display layer only**; storage stays hundredths of an inch.
- Undo/redo for the session.
- Fit-feedback signals surface here later (Tier 4), suggesting adjustments — never auto-applying.

Also build: `/admin/sizing/categories` · `/admin/sizing/fit-profiles` · `/admin/sizing/archetypes` · `/admin/sizing/limits` · `/admin/fabrics` (minimal).

**Part 2 exit:** Shahneela opens the KAMEEZ block, changes M LENGTH 30″→27″, and every size regrades to 25/26/27/28/29/30 with increments intact. She pins XXL at 31″, edits the base again, XXL holds. `calculateCutSpec()` produces a tailor-ready spec from a standard size *and* from a customer's own measurements, with ease and shrinkage applied and rounded to 0.25″.

---

# PART 3 — STUDIO DEFAULTS & PROMPT TEMPLATES

## 3.1 Studio defaults

`/admin/settings/studio` — set once, edited rarely: default **archetype**, base size, backdrop/lighting profile, default AI model per job, default lead time, default price tier, active prompt template version.

## 3.2 Prompt templates

The **fixed scaffolding lives in versioned code**, not the database. Only variables are stored per design — so improving the template improves every future design at once.

```ts
// modules/ai/prompts/sketch-to-photo.v3.ts
export const SKETCH_TO_PHOTO_V3 = {
  version: 3,
  build(vars: PromptVars): { prompt: string; negative: string } { ... }
};
```

Structure (▪ = fixed):
- ▪ "Photorealistic fashion e-commerce photograph… reproduce the garment precisely as drawn…"
- Garment description, colours, fabrics, embroidery *(variables)*
- ▪ Model block — injected from the selected `house_models` record (build description, height)
- ▪ Set & lighting — seamless warm-greige studio, soft diffused daylight
- ▪ Camera — full length, 85mm look, sharp on garment
- ▪ Style — high-end modest catalog photography, realistic
- Angle *(variable)*
- ▪ Negatives — no text, no logo, no altered neckline/hem, no oversaturation, no Western dress

---

# PART 4 — STAGE 1: THE BRIEF

**Rule: no generation runs until the brief is complete — but the designer should almost never have to *fill* it.** "Complete" and "manually entered" are different things. Every field must have a value before generation (it feeds the prompt, and changing it later costs money to regenerate), but most arrive pre-filled.

**Design target: sketch to "Generate" in under 30 seconds and no more than 4 decisions.** If a routine upload needs more, the implementation is wrong.

## 4.1 Three tiers of values

| Tier | Set where | How often | Fields |
|---|---|---|---|
| **1 — Studio defaults** | `/admin/settings/studio` | Once | Archetype, base size, backdrop, AI model, lead time, price tier, template version |
| **2 — Collection context** | On the collection | Once per drop | Season, occasions, work tags, **fabric palette** (narrows the picker to 6 relevant swatches, not 60), price band, default archetype |
| **3 — Per design** | Upload screen | Every design | Sketch(es), **fabric**, **base colourway** — plus corrections to the vision pre-fill |

Inherited values render **filled, dimmed, and overridable** — never as empty required fields.

*If Collections (Tier 3 module 5) isn't built yet, Tier 2 falls back to studio defaults. Design for it now; degrade gracefully.*

## 4.2 Vision pre-fill

On sketch upload, one cheap vision call (~$0.001) proposes: garment category and components, neckline, sleeve type, cuff, hem shape, silhouette, fit-profile guess, embroidery description and placement, and a draft `garmentDescription` for the prompt.

Present as **editable chips, already applied** — not a form to complete. She glances, corrects one or two, moves on.

If the call fails or is low-confidence, fall back to category defaults silently and flag the field. **Never block generation on a failed vision pass.**

## 4.3 What she actually does

1. Drop the sketch(es) — roles auto-assigned by filename + vision
2. Glance at the proposed brief
3. Pick **fabric + colour** — the only two genuinely per-design choices, both pickers
4. Generate

Name auto-generates (`KAMEEZ-2026-014`), renamable later. Price, lead time, occasion, season, archetype, base size and size block all inherit.

## 4.4 Escape hatches (all four required)

- **"Advanced"** disclosure — the full field set, collapsed by default
- **"Duplicate from…"** — clone a previous design's entire brief except the sketch; the biggest time-saver in a coherent collection
- **Bulk upload** — drop 10 sketches, get 10 drafts sharing the collection brief, each queued for its own hero loop. Without this, a 20-piece drop means running the wizard twenty times and she will stop using the tool.
- **Sticky last-used** — any override becomes the default for her next design that session

## 4.5 Deferred to publish

Price, tags, fabric metres, lead time, size block choice, fit profile, SEO — asked at the **publish gate**, not upfront. She is in *creative* mode when uploading a sketch and *commercial* mode when publishing. Asking for a price before she has seen the garment is the wrong question at the wrong moment.

## 4.6 Live prompt preview

The assembled prompt in a collapsible panel, **editable**, collapsed by default. Highest-leverage quality control in the system and free to expose. Hand edits save to the design's prompt profile.

## 4.7 Validation

Generation blocks only if something has **no value at all**. Progressive checklist, never error-on-submit. The Generate button stays disabled with a plain hint: *"Pick a fabric to continue."*

---

# PART 5 — STAGE 2: INPUT SET

A design is an **input set**, not "a sketch."

## 5.1 Asset roles

| Role | What it is | Feeds |
|---|---|---|
| `SKETCH_FRONT` | primary front drawing | Hero — structural anchor (ControlNet) |
| `SKETCH_BACK` | back view drawing | **BACK angle directly** |
| `SKETCH_SIDE` | side/three-quarter drawing | THREE_QUARTER angle |
| `SKETCH_DETAIL` | close-up: embroidery, cuff, neckline, hem | Detail fidelity on every stage |
| `TECHNICAL_FLAT` | flat, proportionally accurate drawing | Proportion anchor; outranks a styled illustration for structure |
| `FABRIC_SWATCH` | fabric photograph | Colour, weave, sheen, **print scale** |
| `REFERENCE_OWN` | her own past design or approved render | Style continuity |
| `REFERENCE_EXTERNAL` | outside inspiration image | Mood only — **IP-gated, §5.4** |

Multiple assets per role allowed, each with an optional **weight** (0–1) — "follow the flat strictly, treat the illustration as mood."

## 5.2 Upload UI

Multi-file drop zone; each file becomes a card where she sets role (auto-guessed via filename + vision, always overridable) and weight.

Live summary stating what the system will do:
> *"1 front sketch · 1 back sketch · 2 details · 1 fabric — the back angle will follow your back sketch."*

**Sketch preprocessing** per sketch-role asset, automatically: deskew → crop to drawing → contrast boost → **lineart/Canny derivative**. Store both. The derivative is the ControlNet conditioning input *and* the source of the storefront's sketch→render reveal animation (free reuse).

Use `sharp` for deskew/crop/contrast; a Canny implementation or a fal lineart preprocessor for the derivative.

## 5.3 Modes (inferred, never asked)

| Mode | Trigger | Behaviour |
|---|---|---|
| **A — single sketch** | `SKETCH_FRONT` only | Standard path |
| **B — multi-sketch** | Front + back/side/detail | Back/side sketches condition their own angles (Part 8); details raise embroidery fidelity |
| **C — reference-led** | No sketch, references present | No ControlNet lock; expect more iterations; flag `origin: REFERENCE_LED` |
| **D — fabric-led** | Fabric only | Exploratory concept; must still pass the hero loop |

Show the inferred mode; allow override.

## 5.4 ⚠️ The IP gate

Generating a "new" design from another label's published garment photo can produce a **derivative work**. Embroidery motifs and prints are frequently registered designs, and in this market the source is often a competitor with standing to act. **"The AI made it" is not a defence.**

- `REFERENCE_EXTERNAL` requires an explicit, timestamped, versioned attestation: *"I have the right to use this reference, or it is being used for general mood only."*
- Designs with external references are flagged and **cannot skip review**; the reference is shown beside the output at the publish gate.
- External references are **transient**: used for conditioning, never published, purged on schedule. Only `REFERENCE_OWN` persists.
- UI copy, in the AKS voice: *"Use references for mood, not to reproduce someone else's design."*
- If the brief is "make this dress but change the colour" — stop. That is copying with extra steps.

---

# PART 6 — STAGE 3: HERO LOOP

`/admin/studio/[id]`

Generate **one image**: front angle, base colourway, base size, on the selected archetype. ~$0.08 per attempt. That is the unit of iteration.

**Layout:** sketch pinned left at 1:1 (hover to zoom) · generated hero large right · prompt/controls in a collapsible rail · last 4 attempts as a strip below (click to promote).

**Actions per attempt:**
- **Approve** → `HERO_LOCKED`
- **Regenerate with notes** → free text appended to prompt, new seed
- **Regenerate same seed, edited prompt** → surgical fix, composition preserved
- **Reject** → discarded but retained in history
- **Switch model** → dropdown; record `modelId` on every generation

**Notes → prompt delta.** She types *"sleeves too short, embroidery sits too high, fabric looks like satin — should be matte lawn."* A cheap LLM converts this to structured prompt modifications. **Store the resolved final prompt**, not the instruction — reproducibility must survive.

**Cost meter, always visible:** *"This design so far: $0.64 · 8 attempts"* plus the monthly cap bar. Makes spend self-regulating without policy.

---

# PART 7 — STAGE 4: SIZING THIS DESIGN

Triggered after `HERO_LOCKED`. **This entire stage costs $0.00** — she can tweak all day.

## 7.1 Opt-in, not mandatory

The category's standard block (Part 2) is **already applied and correct**. This screen exists for when she *wants* to deviate — "make this 3″ shorter than standard." If she never opens it, the design publishes with the standard chart and nothing is missing. **Never force a designer through a size editor on a design that uses stock sizing.**

## 7.2 The chart

Loads the category default via `resolveChart()` (Part 2.3). The **first edit forks a private copy** for this design.

## 7.3 Editing

Identical mechanics to Part 2.3 — delta propagation on the base cell, pinning on non-base cells, editable increments. Do not reimplement; call the same engine.

## 7.4 The calibrated overlay ⭐

**The problem:** AI has no ruler. You cannot prompt "make it 27 inches" and get dimensional accuracy — you get *a shorter shirt* at an unpredictable length, and regenerating drifts the face and embroidery.

**The solution:** don't regenerate. Draw on the existing render.

```ts
const pixelsPerInch = detectSubjectHeight(heroImage) / archetype.heightInches;
const y = anchorY(measurementKey) + (valueInches * pixelsPerInch);
// draw chalk dimension line + Martian Mono numeral at y
```

She sees **exactly** where 27″ lands on the actual photoreal model — mid-thigh, above the knee — instantly, free, with zero identity drift because no pixels are regenerated.

This is why the archetype's height must be authored (Part 2.6). Anchor points per measurement key (shoulder line for LENGTH, waist line for RISE) are stored per category and calibrated once per archetype.

*Optional Layer 2 — mesh warp.* For deltas within ±3″, apply a 2D mesh deformation (compress above the hem, tighten the bust silhouette) so she *sees* the shape change. Identity is perfectly preserved because you're moving existing pixels. Beyond ±3″ it distorts — fall back to the overlay, which stays exact at any delta. **Build the overlay first; add warp only if she asks.**

## 7.5 Apply

"Apply sizing" writes the final chart and triggers **one** regeneration of the hero at the final spec (~$0.08). One cost, at the end. Then `SIZING_LOCKED`.

---

# PART 8 — STAGE 5: ANGLES

Generates `THREE_QUARTER` and `BACK`, each conditioned on the **locked hero** (fabric, colour, lighting, embroidery consistency) plus the archetype identity references.

**Use her drawings when she made them.** If `SKETCH_BACK` exists, the back angle takes *structure* from that sketch and *consistency* from the locked hero — both passed as references. Same for `SKETCH_SIDE` → `THREE_QUARTER`. Only interpolate an angle she hasn't drawn.

> Inventing a back she already designed is the most annoying possible failure, because the back neckline, closure and hem are exactly what she drew it to specify.

Label the source on the review screen — *"back: from your sketch"* vs *"back: interpolated"* — so she knows what to scrutinise.

Review: three angles side by side, hero marked as master, per-angle Approve / Regenerate with notes / Reject. A regenerated angle always re-derives from the locked hero, never from another angle. All approved → `ANGLES_LOCKED`.

---

# PART 9 — STAGE 6: COLOURWAYS

For each additional colourway (name + fabric + target colour), run a **recolour job over the 3 locked angles** — garment shape preserved, colour/fabric retextured.

- Use the cheap model (~$0.04) — shape is already solved, this is retexture.
- **Batch all 3 angles of a colourway as one job group** so they stay mutually consistent.
- Cost preview before running: *"3 colourways × 3 angles = 9 images, ~$0.36."*
- Review as a grid (rows = colourways, columns = angles). **Approve per colourway as a set** — a half-approved colourway is meaningless to the storefront.
- Optional `LAZY` flag: generate on first customer view, then cache.

Output writes `design_renders(designId, colourwayId, angle, assetId)` — **this is the cache the storefront's instant colour swap reads.** Runtime never generates.

One base colourway is enough to publish. Extra colours are an action she chooses, not a stage she must clear.

---

# PART 10 — STAGE 7: PUBLISH

Blocking checklist, shown as a checklist rather than an error on submit:

- [ ] Hero locked · Angles locked (3/3)
- [ ] ≥1 colourway approved
- [ ] Base price, fabric consumption (metres), lead time
- [ ] Size block resolved for every component
- [ ] Fit profile set per component
- [ ] Customization options + price deltas
- [ ] Occasion / season / work tags
- [ ] **Alt text on every render** (accessibility — required)
- [ ] **AI-visualization label** present on all customer-facing renders
- [ ] Model disclosure text generated (Part 2.6)
- [ ] IP attestation reviewed, if external references used

Publishing flips `designs.status → PUBLISHED` and writes storefront-visible rows.

---

# PART 11 — TECHNICAL

## 11.1 Stack (fixed)

Next.js 15 (App Router, RSC) · TypeScript strict · Tailwind v4 + shadcn/Radix · Drizzle + PostgreSQL 16 · Redis + BullMQ · Cloudflare R2 · Auth.js v5 · nuqs · React Hook Form + Zod · TanStack Table · `sharp` · Sentry + PostHog.

## 11.2 AI provider — fal.ai

One provider, one adapter. **No vendor SDK imported outside `modules/ai/providers/`.**

```bash
npm install @fal-ai/client sharp
```
```
FAL_KEY=...        # .env only, never committed
```

```ts
export interface ImageGenProvider {
  sketchToGarment(i: SketchToGarmentInput): Promise<GenerationResult>;
  recolour(i: RecolourInput): Promise<GenerationResult>;
  moderate(i: ModerationInput): Promise<ModerationResult>;
}
```

**Model routing — configuration, never AI-decided:**

| Job | Model class | ~Cost/image |
|---|---|---|
| Hero render | best identity/outfit consistency (Nano Banana class) | $0.08 |
| Angles | same as hero | $0.08 |
| Colourway recolour | budget retexture (Seedream / Flux Kontext class) | $0.04 |
| Cheap drafts | fast/cheap (Flux schnell class) | ~$0.01 |

Verify live model IDs and prices in fal's dashboard before wiring — they change monthly.

*(Routing must stay config: if a model were chosen dynamically, the acceptance-rate data in §11.6 would be confounded and unusable.)*

## 11.3 Job queue

Every generation is a BullMQ job on a **long-lived Node worker (Fly.io) — not serverless**; these exceed function timeouts.

```
queue: design-generation
job:   { generationId, stage, designId, modelId, input }
```

Requirements: idempotency key per job (`designId:stage:angle:colourwayId:attemptN`) · exponential backoff · dead-letter after 3 failures · `costUsd` and `latencyMs` recorded on success *and* failure · SSE/polling progress with real stage names · **spend-cap check before enqueue** (over cap → refuse with a clear message, never silent failure).

## 11.4 State machine

```
DRAFT → BRIEF_COMPLETE → INPUTS_UPLOADED
      → HERO_GENERATING ⇄ HERO_REVIEW → HERO_LOCKED
      → SIZING → SIZING_LOCKED
      → ANGLES_GENERATING ⇄ ANGLES_REVIEW → ANGLES_LOCKED
      → COLOURWAYS_GENERATING ⇄ COLOURWAYS_REVIEW
      → READY_TO_PUBLISH → PUBLISHED → ARCHIVED
```

All transitions through Module 1's `transition()`, validated against an allow-list, writing a `design_events` row **in the same transaction**. Never a raw `UPDATE`.

**No downstream job may run against an unlocked hero** — enforce in the machine, not the UI. Unlocking is permitted with confirmation and **marks all downstream renders stale** (never silently kept); show the regeneration cost before she confirms.

## 11.5 Cost per design

| Stage | Images | Cost |
|---|---|---|
| Hero iteration (~6 attempts) | 6 | $0.48 |
| **Sizing** | **0** | **$0.00** |
| Regenerate at sizing lock | 1 | $0.08 |
| Angles | 2 | $0.16 |
| Colourways (3 × 3) | 9 | $0.36 |
| **Total** | ~18 | **≈ $1.08** |

30-design launch ≈ **$33**.

## 11.6 Governance

Hard monthly cap checked before enqueue · kill switch (storefront stays fully transactional when AI is down) · `/admin/ai-spend` showing spend vs. cap, breakdown by pipeline and model, and **cost per *approved* image by model** — the metric that actually decides model choice, since a $0.08 model approved on attempt 2 beats a $0.04 model approved on attempt 6.

---

# PART 12 — DATA MODEL

```
-- SIZING (Part 2)
garment_categories        id, key, name, nameUr, measurementKeys[], active, sortOrder
measurement_keys          key, label, labelUr, bodyOrGarment, anchorPoint, helpText, demoVideoAssetId

size_blocks               id, name, categoryId, isDefault, ownerDesignId?,
                          sizeLabels[], baseSizeLabel, notes, active
size_block_rows           id, blockId, measurementKey, baseValue, gradeIncrement,
                          gradeOverrides jsonb, sortOrder
size_block_cells          blockId, measurementKey, sizeLabel, value, isPinned,
                          editedById, editedAt        -- ONLY pinned overrides

fit_profiles              id, name, categoryId, easeByMeasurement jsonb,
                          clingFactor, isDefault, notes

house_models              id, name, isDefault, active, heightCm, heightInches,
                          bust, waist, hip, shoulder, wearsSizeLabel,
                          buildDescription, identitySeed, referenceAssetIds[],
                          isAiGenerated
                          -- + per-category anchorPoint calibration for the overlay

fabrics                   id, name, composition, weightGsm, widthInches,
                          swatchAssetId, careInstructions, drapeNotes,
                          stretchPercent, shrinkageAllowance, drapeClass, active
                          -- Tier 2 extends with lots/suppliers, additively

custom_size_limits        categoryId, measurementKey, minValue, maxValue, step,
                          crossFieldRules jsonb

-- DESIGN STUDIO (Parts 4–10)
design_inputs             id, designId, assetId, role, weight,
                          derivedAssetId, attestationId?, purgeAt?

design_prompt_profiles    designId, garmentDescription, shirtColour, shirtFabric,
                          trouserColour, trouserFabric, embroideryDescription,
                          backdrop, extraNotes, templateVersion,
                          origin (SKETCH_LED|REFERENCE_LED|FABRIC_LED),
                          combinationBrief?

design_generations        id, designId, stage (HERO|ANGLE|COLOURWAY), angle?,
                          colourwayId?, parentGenerationId,
                          archetypeId, sizeBlockSnapshot jsonb,
                          provider, modelId, promptJson, negativePrompt, seed,
                          templateVersion, inputAssetIds[], outputAssetId,
                          status, costUsd, latencyMs, error,
                          decision, decidedBy, decidedAt, notes
                          -- APPEND ONLY; seed + prompt make every attempt reproducible

design_locks              designId, stage, generationId, lockedBy, lockedAt
design_events             designId, fromStatus, toStatus, actorId, note, createdAt
design_renders            designId, colourwayId, angle, archetypeId, assetId,
                          isAiGenerated, altText, sortOrder
```

`parentGenerationId` is the consistency chain: angles point at the locked hero, colourways at the locked angles. It is also the audit trail the IP gate depends on.

---

# PART 13 — BUILD ORDER

| # | Step | Exit criterion |
|---|---|---|
| 1 | Survey & reconciliation report | Plan approved |
| 2 | Sizing schema + measurement key seed | Migrations clean; keys present |
| 3 | **Grading engine (pure) + unit tests** | `resolveChart`, delta, pinning, overrides tested — incl. `does_not_scale_proportionally` |
| 4 | Categories, blocks, seed data | KAMEEZ block resolves to Part 2.2 exactly |
| 5 | **Size chart editor UI** | M LENGTH 30→27 shifts row to 25/26/27/28/29/30 |
| 6 | Pinning, unpin, fork-on-edit, revert | Pinned XXL survives base edit; shared block untouched |
| 7 | Fit profiles, fabrics, archetypes, limits | Four archetypes seeded; `isAiGenerated` enforced |
| 8 | **Cut-spec calculator + tests** | Same function, correct from a standard size *and* custom measurements |
| 9 | Studio defaults + prompt templates | Prompt assembles from the brief, hand-editable |
| 10 | Brief wizard + vision pre-fill | Under 30s, ≤4 decisions on a routine upload |
| 11 | Input set + roles + preprocessing + IP gate | Multi-sketch produces lineart; external refs require attestation |
| 12 | fal adapter + single generation + cost ledger | One hero generates, cost recorded |
| 13 | Hero loop: attempts, notes→delta, strip, model switcher | She iterates to an approved image |
| 14 | Lock + state machine + stale invalidation | Locking gates downstream; unlock invalidates correctly |
| 15 | **Calibrated overlay** | Changing length moves an accurate chalk line on the real model, free and instant |
| 16 | Angles (using back/side sketches when present) | 3 consistent angles, source labelled |
| 17 | Colourway batch recolour → `design_renders` | Storefront colour swap works from cache |
| 18 | Publish checklist + model disclosure | Design goes live |
| 19 | Spend cap, kill switch, `/admin/ai-spend` | Cost per *approved* image visible by model |

**Overall exit criterion:**

> Shahneela opens the studio, completes a brief in under 30 seconds, uploads a paper sketch (front and back), iterates to a hero she likes, adjusts M LENGTH from 30″ to 27″ and watches every other size regrade *and* the chalk line move on the real model, applies it, gets three consistent angles (the back following her back sketch) and three colourways, fills the checklist, and publishes — and the design appears on the storefront with instant colour switching, an accurate size guide, and the model-measurement disclosure. Total AI spend for that design: about $1.

---

# PART 14 — NON-NEGOTIABLES

**Sizing**
1. All measurements are **integer hundredths of an inch**; metres integer hundredths; money integer minor units. **Never floats.** Convert at the UI boundary only.
2. Sizing math is **deterministic arithmetic**. AI never computes a measurement.
3. Grading propagates by **delta**, never proportional scaling.
4. Unpinned cells are **computed, never stored**.
5. Each measurement has its **own** grade increment. Never a flat multiplier.
6. Length variants are **values, not categories**.
7. Standard and made-to-measure use **one cut-spec calculator**. Never two code paths.
8. Shrinkage allowance is always applied to the cut spec.
9. Every value rounds to **0.25″**.
10. Editing a design's chart must never mutate a shared block — **fork on edit**.
11. Custom-size limits are enforced **where the visual updates**, so an impossible body cannot render.

**Archetypes**
12. House model measurements are **authored**, never inferred from an image.
13. The house model must be an **AI-generated persona** (`isAiGenerated = true`). Never a real person's likeness without an AI-derivative release.

**Design flow**
14. **No generation before the brief is complete.** No downstream job against an unlocked hero.
15. Every stage after the hero must have a correct default that lets her **skip it**. Sizing and extra colourways are opt-in.
16. External references require attestation, are reviewed before publish, are never published, and are purged on schedule.
17. Every AI image sets `isAiGenerated = true` and carries a visible **AI-visualization label**.
18. Nothing publishes without Shahneela's approval. **This gate is not configurable.**

**Platform**
19. State changes only via `transition()`, writing an event row in the same transaction. Never a raw `UPDATE`.
20. No vendor SDK outside its adapter module. Every provider call is an idempotent, cost-recorded job.
21. Model routing is **configuration**, never AI-decided.
22. The storefront stays **fully transactional** when every AI provider is down.
23. `<Measure>` renders every measurement, `<Money>` every price. Every admin mutation writes an audit log.
