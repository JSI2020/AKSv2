# AKS — /docs MANIFEST
### What goes in the /docs folder, and which build steps use each file

The six `AKS_BUILD_00`–`05` files are the **step-by-step instructions** — run those. This folder holds the **reference documents** they occasionally point to for fuller detail. Set up `/docs/` with the files below before you start, and every cross-reference in the build steps will resolve.

**The build steps are mostly self-contained.** These references add depth (full catalogues, complete algorithms, longer reasoning). Only the few steps marked ⭐ genuinely *need* their referenced doc to be complete.

---

## Files to place in `/docs/`

| File | Purpose | Used by steps |
|---|---|---|
| `AKS_BUILD_00_INDEX.md` | Method, `.cursorrules`, step list | — (start here) |
| `AKS_BUILD_01_FOUNDATION.md` | Steps 1–12 | run directly |
| `AKS_BUILD_02_SIZING.md` | Steps 13–20 | run directly |
| `AKS_BUILD_03_COMMERCE.md` | Steps 21–34 | run directly |
| `AKS_BUILD_04_DESIGN_STUDIO.md` | Steps 35–42 | run directly |
| `AKS_BUILD_05_OPERATIONS.md` | Steps 43–50 | run directly |
| `AKS_Design_And_Sizing_Unified.md` | Full sizing + design-studio reference | 13–20, 35–42 |
| `AKS_Admin_Portal_Prompt.md` | ⭐ Full permission catalogue; costing detail | 11, 47 |
| `AKS_Tier1_RealShop_Prompt.md` | Commerce depth | 21–34 (context) |
| `AKS_Tier2_Production_Prompt.md` | ⭐ Full fabric allocation + production detail | 43–45 |
| `AKS_Brand_Foundation.md` | ⭐ Copy voice, tone, real copy examples | 26, 28, 34, 39 (all customer copy) |
| `AKS_Sizing_System_Complete.md` | ⭐ The customer-facing 3D size guide (Part 11) | post-34, optional |
| `AKS_Tier4_Growth_Prompt.md` | Reviews, marketing, analytics detail | deferred features |

---

## The ⭐ steps — where the reference is genuinely needed

Most build steps embed everything they need. These four lean on their doc for detail I compressed to keep the step pasteable:

**Step 11 (RBAC) → `AKS_Admin_Portal_Prompt.md` Part 2**
The full permission-key catalogue (`module.action` for every module) and the exact role→permission mappings. The build step names the roles; the doc has the complete grant matrix.

**Steps 43–45 (fabric & production) → `AKS_Tier2_Production_Prompt.md`**
The complete `allocateFabric` algorithm (match-groups, FIFO, escalation), the full production schema, and the bilingual tailor-spec-sheet layout.

**All customer-facing copy → `AKS_Brand_Foundation.md`**
Steps 26, 28, 34 and 39 produce text a customer reads. The doc has the voice rules and real copy examples so it comes out "a friend who sews," not generic.

**Post-step-34 (3D size guide) → `AKS_Sizing_System_Complete.md` Part 11**
The only place the morph-target architecture, asset procurement, and SMPL licensing warning live. Not built in the 50 steps — build only if demand justifies the 3D asset cost.

---

## What you already have

All of these files were produced during our work and are in your outputs. Collect them into one `/docs/` folder. If any is missing, the build step that references it says which part it needs, so you can regenerate just that piece.

## What is NOT a dependency

`AKS_Configurator_Cart_Flow_Spec.md`, `AKS_Module1_Foundation_Prompt.md`, `AKS_Module3_SizeSystem_Prompt.md`, `AKS_Tier3_AICatalog_Prompt.md`, `AKS_Rebuild_Steps.md`, and the earlier standalone prompts are **superseded** by the BUILD files. Keep them archived for reference if you like, but the BUILD files do not point to them — don't put them in `/docs/` or you'll create ambiguity about which is authoritative.

---

## Setup checklist

- [ ] Create the repo (BUILD file 00 → Part 1)
- [ ] Create `.cursorrules` at root (BUILD 00 → the rules block)
- [ ] Create `/docs/` and add the 13 files from the table above
- [ ] Clone the reference repo into `/reference/` and gitignore it (step 2)
- [ ] Confirm each ⭐ doc is present before reaching its step
- [ ] Start step 1 in a fresh Cursor chat

---

## One rule to prevent drift

**The BUILD files are authoritative.** If a reference doc ever contradicts a BUILD step, the BUILD step wins — it's the newer, deduplicated version. The reference docs are for depth, not for override. Each BUILD file states this at its top.
