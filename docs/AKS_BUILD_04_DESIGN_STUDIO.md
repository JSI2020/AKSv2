# AKS BUILD — 04: DESIGN STUDIO
### Steps 35–42 · the backbone, part 2 — sketch to published design

> **What this delivers:** Shahneela photographs a paper sketch, and the system produces photorealistic product imagery on a consistent house model, in three angles, in multiple colourways, correctly sized — for roughly **$1 per design**, with no photoshoot.
>
> Reference spec: `/docs/AKS_Design_And_Sizing_Unified.md` Parts 3–11.

---

## The architecture, in one paragraph

**Generate once, derive many.** Iterate on a single front image until she approves it, then **lock** it. Every angle and every colourway is derived from that locked master, passed as a reference image. This is what keeps the embroidery in the same place and the fabric reading identically across nine images — and it costs roughly a tenth of regenerating everything on each attempt.

**Sizing costs nothing.** AI has no ruler; you cannot prompt "make it 27 inches" and get dimensional accuracy. So sizing never regenerates — it draws a calibrated line on the existing render, using the archetype's known height. One regeneration at the end when she applies.

```
BRIEF → INPUTS → HERO LOOP → [LOCK] → SIZING → ANGLES → COLOURWAYS → PUBLISH
        (~$0.08/attempt)      ($0.00)   (+$0.08)  (+$0.16)  (+$0.36)
```

---

## STEP 35 — Studio settings & prompt templates

**Goal:** the fixed scaffolding, so no design invents its own prompt.

**Prompt:**
> Create `/admin/settings/studio` holding studio defaults: default archetype, default base size, backdrop/lighting profile description, default AI model per job type, default lead time, active prompt template version.
>
> Create the prompt template system in `/modules/ai/prompts`. **The fixed scaffolding lives in versioned TypeScript, not the database** — only per-design variables are stored, so improving the template improves every future design.
>
> Template v1 structure — fixed parts (never varied): an instruction to produce a photorealistic fashion e-commerce photograph reproducing the garment precisely as drawn in the attached sketch, without redesigning or omitting any detail; a model block injected from the selected `house_models` record using its buildDescription and height; a set-and-lighting block describing a clean studio with a seamless warm-greige background and soft diffused daylight; a camera block specifying full length, 85mm lens look, sharp focus on the garment; a style block specifying high-end modest fashion catalog photography, realistic not stylised; and a negative list — no text, no logo, no altered neckline or hem, no oversaturation, no colour bleed between garment pieces, no distortion of embroidery, no Western dress.
>
> Variable parts: garment description, shirt colour and fabric, trouser colour and fabric, embroidery description, and angle.
>
> Create `design_prompt_profiles` (designId, and the variable fields above, plus templateVersion, origin SKETCH_LED|REFERENCE_LED|FABRIC_LED, combinationBrief nullable).

**Exit:** given sample variables, the template assembles a complete, readable prompt you can inspect.

---

## STEP 36 — fal.ai adapter & job queue

**Goal:** generate one image, reliably, with cost recorded.

**Prompt:**
> Install `@fal-ai/client` and `sharp`. Store `FAL_KEY` in env only, never committed.
>
> Define `ImageGenProvider` in `/modules/ai` with `sketchToGarment`, `recolour`, and `moderate`. Implement a fal adapter behind it in `/modules/ai/providers/fal.ts`. **No fal SDK import outside that file.**
>
> Model routing is **configuration, not AI-decided** — a fixed map from job type to model id: hero and angles use the highest-consistency model, colourway recolour uses a cheaper retexture-capable model, drafts use the fastest cheap model. **Look up the current model ids and per-image prices in the fal dashboard before wiring — do not invent model identifiers.** Put them in settings so they can be changed without a deploy.
>
> Create `design_generations` (id, designId, stage HERO|ANGLE|COLOURWAY, angle nullable, colourwayId nullable, parentGenerationId nullable, archetypeId, sizeBlockSnapshot jsonb, provider, modelId, promptJson, negativePrompt, seed, templateVersion, inputAssetIds array, outputAssetId, status, costUsd, latencyMs, error, decision PENDING|APPROVED|REJECTED, decidedBy, decidedAt, notes). **Append-only** — rejected attempts are the version history, and seed plus prompt make every attempt reproducible.
>
> Every generation is a BullMQ job on the step 8 worker: idempotency key `designId:stage:angle:colourwayId:attemptN`, exponential backoff, dead-letter after 3 failures, `costUsd` and `latencyMs` recorded on success *and* failure, progress streamed to the UI with real stage names. **Check the monthly spend cap before enqueueing** — over cap refuses with a clear message, never a silent failure.

**Exit:** one image generates from a hardcoded test prompt, appears in R2, and its cost and latency are recorded.

---

## STEP 37 — Design brief

**Goal:** collect what feeds the prompt — in under 30 seconds.

**Prompt:**
> Build `/admin/studio/new`.
>
> **The brief must be complete before generation, but the designer should almost never have to fill it.** Values arrive from three tiers: studio defaults (step 35), collection context if the design is created inside a collection, and finally per-design input. Inherited values render **filled, dimmed and overridable** — never as empty required fields.
>
> The only genuinely per-design inputs are: the sketch, the **fabric**, and the **base colourway**. Everything else inherits. Name auto-generates as `{CATEGORY}-{YEAR}-{SEQ}` and is renamable.
>
> Every selection is a searchable dropdown reading from existing records — fabric, category, archetype, size block, fit profile, occasion, season, work type. Each dropdown supports inline "+ Add new" without leaving the screen. Free text only for name, description and notes.
>
> Defer to the publish gate: price, fabric metres, lead time, SEO, tags. She is in creative mode here and commercial mode at publish.
>
> Add three escape hatches: an "Advanced" disclosure showing the full field set; "Duplicate from…" cloning a previous design's entire brief except the sketch; and sticky last-used values within a session.
>
> Show the assembled prompt in a collapsible, **editable** panel, collapsed by default.
>
> Generation is blocked only if a field has no value at all — show a progressive checklist with a plain hint such as "Pick a fabric to continue", never an error wall on submit.

**Exit:** with defaults set, you create a design brief in under 30 seconds and no more than four decisions.

---

## STEP 38 — Input set & sketch preprocessing

**Goal:** accept several drawings per design, and prepare them for conditioning.

**Prompt:**
> Create `design_inputs` (id, designId, assetId, role, weight 0–1 default 1, derivedAssetId, attestationId nullable, purgeAt nullable).
>
> Roles: `SKETCH_FRONT`, `SKETCH_BACK`, `SKETCH_SIDE`, `SKETCH_DETAIL`, `TECHNICAL_FLAT`, `FABRIC_SWATCH`, `REFERENCE_OWN`, `REFERENCE_EXTERNAL`.
>
> Build a multi-file drop zone where each file becomes a card with an editable role and weight. Show a live summary stating what the system will do — for example: "1 front sketch · 1 back sketch · 2 details · 1 fabric — the back angle will follow your back sketch."
>
> **Sketch preprocessing** runs automatically on each sketch-role asset using `sharp`: deskew, crop to the drawing, boost contrast, then produce a lineart derivative for structural conditioning. Store both the original and the derivative — the derivative is also reused later for the storefront's sketch-to-render reveal, so it costs nothing extra.
>
> Infer the mode from what is uploaded and display it, allowing override: front sketch present → sketch-led; no sketch but references present → reference-led; fabric only → fabric-led.
>
> **IP gate:** uploading a `REFERENCE_EXTERNAL` asset requires an explicit, timestamped, versioned attestation — "I have the right to use this reference, or it is being used for general mood only." Designs containing an external reference are flagged, cannot skip review, and the reference is shown beside the output at the publish gate. External references are transient — used for conditioning, never published, purged on schedule. Only `REFERENCE_OWN` persists. UI copy: "Use references for mood, not to reproduce someone else's design."

**Exit:** uploading a front and back sketch plus a fabric photo produces correct roles, lineart derivatives, and an accurate summary line.

---

## STEP 39 — Hero generation loop ⭐

**Goal:** iterate cheaply to an image she approves.

**Prompt:**
> Build `/admin/studio/[id]`. Generate **one image only**: front angle, base colourway, base size, on the selected archetype. This is the unit of iteration.
>
> Layout: the sketch pinned left at 1:1 with hover zoom, the generated hero large on the right, prompt controls in a collapsible rail, and the last four attempts as a strip below — clicking one promotes it to the main view. Choosing the best of several is a far easier judgement than approving one in isolation.
>
> Actions per attempt: **Approve** (moves to locked), **Regenerate with notes**, **Regenerate with same seed and edited prompt** (surgical fix, composition preserved), **Reject** (discarded but retained in history), and **Switch model**.
>
> Notes-driven regeneration is the primary interface. She types something like "sleeves too short, embroidery sits too high, fabric looks like satin — should be matte lawn." Use a cheap LLM to convert that into structured prompt modifications. **Store the resolved final prompt, not the instruction** — reproducibility must survive.
>
> Show an always-visible cost meter: "This design so far: $0.64 · 8 attempts", plus the monthly cap bar.
>
> Implement the design state machine through `transition()`: `DRAFT → BRIEF_COMPLETE → INPUTS_UPLOADED → HERO_GENERATING ⇄ HERO_REVIEW → HERO_LOCKED → SIZING → SIZING_LOCKED → ANGLES_GENERATING ⇄ ANGLES_REVIEW → ANGLES_LOCKED → COLOURWAYS_GENERATING ⇄ COLOURWAYS_REVIEW → READY_TO_PUBLISH → PUBLISHED → ARCHIVED`.
>
> **No downstream job may run against an unlocked hero.** Enforce in the machine.

**Exit:** you iterate through several attempts with notes, approve one, and it locks. Costs accumulate correctly.

---

## STEP 40 — Calibrated sizing overlay ⭐

**Goal:** adjust sizing for this design and *see* it on the real model — instantly and free.

**Prompt:**
> Build the sizing stage, entered after `HERO_LOCKED`.
>
> **This stage is opt-in.** The category's standard block already applies and is correct. This screen exists only for when she wants to deviate — "make this 3″ shorter than standard." If she never opens it, the design publishes with the standard chart and nothing is missing.
>
> Load the chart via step 15's `resolveChart`. The first edit forks a private copy for this design (step 17). Editing uses the **same engine** — delta propagation, pinning, editable increments. Do not reimplement any of it.
>
> **The overlay.** AI has no ruler — prompting "make it 27 inches" yields an unpredictable length, and regenerating drifts the face and embroidery. So do not regenerate on edit. Instead:
>
> Compute pixels-per-inch by detecting the model's pixel height in the locked hero image and dividing by the archetype's known `heightInches` from step 19. Then draw a chalk dimension line with a Martian Mono numeral at the correct pixel offset from that measurement's anchor point. She sees exactly where 27″ lands on the actual photorealistic model — mid-thigh, above the knee — instantly, free, with zero identity drift because no pixels are regenerated.
>
> Store anchor points per measurement key per category, calibrated once per archetype (shoulder line for LENGTH, waist line for RISE, and so on).
>
> "Apply sizing" writes the final chart and triggers **exactly one** regeneration of the hero at the final specification, then moves to `SIZING_LOCKED`.

**Exit:** changing a length value moves an accurate chalk line on the real render, costs nothing, and the model's face does not change. Applying triggers exactly one generation.

---

## STEP 41 — Angles

**Goal:** three consistent views.

**Prompt:**
> Generate `THREE_QUARTER` and `BACK`, each conditioned on **the locked hero** as a reference image (for fabric, colour, lighting and embroidery consistency) plus the archetype identity references.
>
> **Use her drawings when she made them.** If `SKETCH_BACK` exists, the back angle takes its *structure* from that sketch and its *consistency* from the locked hero — both passed as references. Same for `SKETCH_SIDE` → three-quarter. Only interpolate an angle she has not drawn. Inventing a back she already designed is the most annoying possible failure, because the back neckline, closure and hem are exactly what she drew it to specify.
>
> Review screen: three angles side by side at maximum size, the hero visibly marked as master, and per-angle Approve / Regenerate with notes / Reject. Label each angle's source — "back: from your sketch" versus "back: interpolated" — so she knows what to scrutinise. A regenerated angle always re-derives from the locked hero, never from another angle.

**Exit:** three angles generate, the back follows the back sketch when one exists, and the embroidery stays in the same place across all three.

---

## STEP 42 — Colourways & publish

**Goal:** many colours cheaply, then live.

**Prompt:**
> **Colourways.** For each additional colourway (name, fabric, target colour), run a recolour job over the three locked angles — garment shape preserved, colour and fabric retextured. Use the cheaper model; the shape is already solved, this is retexture. **Batch all three angles of one colourway as a single job group** so they stay mutually consistent. Show a cost preview before running: "3 colourways × 3 angles = 9 images, ~$0.36." Review as a grid with rows as colourways and columns as angles, approving **per colourway as a set** — a half-approved colourway is meaningless to the storefront.
>
> Output writes `design_renders(designId, colourwayId, angle, assetId)` with **`isAiGenerated = true`**. This is the same table step 24's `resolveImages` already reads, so instant colour switching starts working on the storefront with no storefront change at all.
>
> One base colourway is enough to publish. Extra colours are an action she chooses, not a stage she must clear.
>
> **Publish gate** — a blocking checklist rendered as a checklist, not an error on submit: hero locked; angles locked 3/3; at least one colourway approved; base price, fabric consumption in metres and lead time set; size block resolved per component; fit profile set per component; occasion, season and work tags; **alt text on every render**; the AI-visualization label present on all customer-facing renders; the model disclosure string from step 19; and the IP attestation reviewed if any external reference was used.
>
> Publishing flips `designs.status` to PUBLISHED.

**Exit:** a paper sketch becomes a published design with three angles and three colourways, live on the storefront with instant colour switching, for roughly $1 in generation cost.

---

## ✅ MILESTONE — DESIGN STUDIO COMPLETE

Cost per design, approximately:

| Stage | Images | Cost |
|---|---|---|
| Hero iteration (~6 attempts) | 6 | $0.48 |
| **Sizing** | **0** | **$0.00** |
| Regenerate at sizing lock | 1 | $0.08 |
| Angles | 2 | $0.16 |
| Colourways (3 × 3) | 9 | $0.36 |
| **Total** | ~18 | **≈ $1.08** |

*(Assumes roughly $0.08 per hero-class image and $0.04 per recolour — **verify current fal pricing**, as it changes.)*

Continue to file 05.
