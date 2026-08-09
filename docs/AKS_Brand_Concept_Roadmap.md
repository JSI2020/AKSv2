# AKS — Brand Concept & Launch Roadmap

Operational digest of *Brand Concept & Launch Roadmap* (working concept, confidential).  
Customer-facing voice still follows [`AKS_Brand_Foundation.md`](./AKS_Brand_Foundation.md). This file is for **product, merchandising, and build priority**.

---

## 1. Positioning (internal)

A quiet-luxury house that reimagines Pakistan’s heritage silhouettes through couture construction and modern modesty — **where the cut, the cloth, and the fall are the ornament**.

| Market shouts with… | AKS signals with… |
|---|---|
| Visible embroidery, zari, heavy surface work | Proportion, drape, finishing |
| More embellishment = more value | Restraint = value |

**Do not try to out-embroider incumbents.** Compete on the empty axis.

In **customer copy**, do not use the word “luxury” (see Brand Foundation lexicon). Internally you may say *quiet-luxury pret / entry-luxury band*.

---

## 2. Customer

Educated, well-travelled, ~28–45. Urban Pakistani, diaspora (UK, UAE, Canada), or Gulf-based. Dresses for herself. Owns heavy formals; wants the opposite for real life. Judges by fabric, fit, finishing, cost-per-wear — not occasion flash.

Underserved today: loud formalwear **or** basic high-street — almost nothing intentional in between.

---

## 3. Design language

1. **Construction as ornament** — panels, drape, seams, hems do the work embroidery usually does.
2. **Tonal, not decorated** — texture and finishing only.
3. **Heritage, refined** — kalidaar, angrakha, farshi, peshwaz, cut to precision.
4. **Modern modesty** — coverage as elegance, not restriction.
5. **East–West in the line** — never a slogan on a banner.
6. **Movement is the statement** — shoot and sell in motion; flat-lays are secondary.

### Construction signatures (every piece)

- Hidden side-seam pockets in every kurta
- Covered fabric buttons matched to cloth; hand-worked buttonholes; fabric loops (never metal hooks)
- Softly curved hems and deep hems
- Invisible stitching; panels and flare cut in, never gathered on

### Hold the line

Never drift toward embellishment to close a single sale. Consistency of tailoring is the brand.

---

## 4. Two palettes (do not conflate)

### A. UI chrome (app chrome — fixed in `.cursorrules`)

`greige` · `ink` · `indigo` · `chalk` · `zari` · `madder`  
Storefront = greige ground. Admin = indigo ground. One radius 2px. No shadows. No gradients.

### B. Fashion / colourway palette (garments & merchandising)

**Core neutrals (spine)**

| Name | Hex |
|---|---|
| Milk | `#F4EEE1` |
| Ivory | `#EAE1CF` |
| Bone | `#DDD2BC` |
| Oyster | `#CDC0A8` |
| Sand | `#BFAA88` |
| Stone | `#A89A80` |
| Taupe | `#8D7E66` |

**Muted accents (seasonal warmth)**

| Name | Hex |
|---|---|
| Tea Rose | `#C6A59B` |
| Antique Gold | `#9A8A6B` |
| Soft Olive | `#7C7C58` |
| Dusty Clay | `#AE7A61` |
| Sage | `#99A088` |
| Ash Blue | `#8C9A9B` |

**Deep anchors (sparingly)**

| Name | Hex |
|---|---|
| Ink (fashion) | `#2B2926` |
| Espresso | `#4A3B2F` |
| Oxblood | `#6B3A3A` |
| Deep Olive | `#3D3E32` |

**Launch editions**

- **White Collection** — milk · ivory · bone · oyster · cream · chalk, separated by shade and texture alone.
- **Lahore Edit** — ivory · sand · tea rose · antique gold · soft olive.

Tonal dressing: contrast from **texture**, not loud colour.

---

## 5. Fabric library (natural, matte / low-sheen)

| Group | Fabrics | Lives in |
|---|---|---|
| Structure & body | Silk crepe / crêpe de chine, pure silk (matte), wool & wool-silk, handloom cotton (khaddi) | Kurtas, peshwaz, farshi fall, angrakha, winter structure, everyday texture |
| Drape & movement | Cotton silk, silk georgette, fine washed linen | Core kurtas, layered farshi, modern-modest everyday |
| Sheer & layering | Silk organza, cotton/silk muslin (mulmul) | Outer farshi, dupattas, sleeves, unlined summer |

Texture and weave replace embellishment. The cloth is the first luxury signal she feels.

---

## 6. Signature looks (design as complete ensembles)

1. **Seen in Motion** — open-side kurta + crescent farshi + heritage dupatta  
2. **For Eid, For the Nikkah** — modern peshwaz + regal churidar  
3. **Regal, Covered, Severe** — maharani kurta + court shalwar  
4. **The Wrap** — heritage angrakha + paneled shalwar  
5. **Layered** — kalidaar kurta + long waistcoat + double-farshi  

Price band (positioning, not a hard rule): **PKR 18,000 – 65,000** quiet-luxury pret; MTM tier may sit above. Bridal couture is not the fight.

---

## 7. Roadmap vs this codebase

| Phase | Intent | AKS app today |
|---|---|---|
| **0 Foundation** | Identity, blocks, fabric partners, atelier QC, White Collection samples | UI tokens + brand voice docs; sizing/blocks in admin; fabric module; studio pipeline |
| **1 Prototype & proof** | Physical fit, motion photography, freeze construction standard | Measure flow + size engine exist; imagery still thin without studio/R2 assets |
| **2 Soft launch** | Few MTO slots; IG + simple site; White Collection | **Full shop + admin already exceed “simple site”** — use them; keep catalogue small and on-brand |
| **3 Establish** | Lahore Edit; content engine; MTM tier; size chart public | MTM/measure + tracking exist; need on-brand content and `/size-guide` |
| **4 Expand** | Diaspora/Gulf; RTW capsule of proven SKUs; trunk shows | Locale `en`/`ur` ready; shipping still Pakistan-first by product rules |

### Soft-launch discipline (what “best” means in product)

1. Prefer a **tight White Collection** over a noisy demo catalogue.
2. Sell **ensembles / looks**, not random SKU sprawl.
3. Default path: **made to measure**; standard size is the fallback.
4. Photography and PDP: **motion and drape first**.
5. Do not add embellishment options to close a sale.
6. Occasion vs everyday: decide deliberately — don’t straddle by accident.

## Soft-launch product gaps

- [x] Size guide storefront page (`/size-guide`)
- [x] Fabrics library page (`/fabrics`)
- [x] Five house collections + hub copy (Essentials · Tailored · Occasion · Signature · Separates)
- [x] Demo seed mapped across house collections
- [ ] Motion photography / studio assets on PDPs
- [ ] Public shipping / returns copy pages (footer links)
- [ ] Optional: heritage Urdu nav pairs / six-word gallery lines / PDP copy templates

---

## 8. Risks (keep visible)

1. **Perceived value** — many buyers still equate value with visible work. Education job: fabric close-ups, fall, fit, finishing, motion.
2. **Occasion problem** — Eid/weddings want “something.” Choose everyday-luxury only **or** a restrained modest-occasion capsule — never both by accident.
3. **Generic minimalism trap** — defensibility is heritage specificity (farshi, angrakha, peshwaz), not abstract Western quiet luxury.
4. **Hold the line** — no embellishment drift for one sale.

---

## 9. Single operating instruction

> Build and merchandise as a house of cut and cloth. The app is the workshop window — keep the catalogue, copy, colourways, and QC standard quieter than the market, and more specific than generic minimalism.
