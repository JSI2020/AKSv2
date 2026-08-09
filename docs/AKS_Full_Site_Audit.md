# AKS — FULL SITE AUDIT
### Verify the built site against the prototype and steps 1–50

> **For:** Cursor (or any reviewer) · run against the finished or in-progress build.
> **How to use:** this is **seven separate audits**, A–G. Run each in its own chat — one giant audit will be shallow and miss things, the same way one giant build prompt failed. Each produces a **PASS / FAIL / PARTIAL** report in the format at the bottom. Fix fails, then re-run that audit only.
>
> **Rule for the auditor:** report what you actually find in the code and the running site. Do not assume a step passed because it exists in a spec. If you cannot verify something, mark it **UNVERIFIED** and say why — never guess PASS.

---

# AUDIT A — RULES COMPLIANCE (the non-negotiables)

These are the invariants from `.cursorrules`. A single violation is a bug regardless of how the screen looks. Most are grep-able.

**Prompt:**
> Audit the codebase against these invariants. For each, search the code, report every violation with file and line, and mark PASS/FAIL.
>
> **Money & measurement**
> 1. No floats for money, measurements, or metres. Search for `number` fields storing currency or lengths; confirm all are integer minor units / hundredths. Flag any `parseFloat`, `/ 100` at storage time, or decimal columns for these.
> 2. `<Money>` wraps every displayed price; `<Measure>` wraps every displayed measurement. Flag raw price/measurement rendering.
>
> **State & data integrity**
> 3. No raw `UPDATE` on a status column anywhere. Every status change goes through `transition()`. Search for direct status writes.
> 4. Order snapshots (price, measurements, address, customization) are jsonb copies, not foreign keys to mutable tables. Confirm in the schema.
> 5. `audit_logs`, `*_events`, and `stock_adjustments` have no update or delete code paths.
>
> **Security**
> 6. Every server action that mutates data calls `requirePermission()` before doing work. List any mutation missing it.
> 7. No password field exists anywhere. No hardcoded OTP. Search the entire codebase for `000000`, `demo`, `password`, and any credential literal — report every hit.
> 8. No public signup route for admin.
> 9. External side effects (email, WhatsApp, AI calls) go through the outbox, not inline. Flag any inline `resend.send`, fetch to fal, etc. outside a worker handler or adapter.
> 10. No vendor SDK (fal, Safepay, Resend) imported outside its adapter folder in `/modules/*/providers/`.
>
> **Sizing**
> 11. No AI call computes a measurement. Sizing math is pure arithmetic in `/modules/sizing/engine`.
> 12. Grading uses delta, not proportional scaling — confirm the `does_not_scale_proportionally` test exists and passes.
>
> Output the report in the standard format. This audit is the most important one — a FAIL here outranks any visual issue.

---

# AUDIT B — VISUAL SYSTEM (tokens, fonts, radius, shadows)

**Prompt:**
> Audit the visual system against the design tokens. Report every deviation with file and line.
>
> **Colour**
> 1. Only these eight tokens are used, nowhere any other hex: greige `#DCD9CF`, greige-deep `#C9C5B9`, ink `#16181D`, indigo `#1B2547`, indigo-lift `#2A3760`, chalk `#8FA6B2`, zari `#B08D4C`, madder `#8C2F39`. Search for any hex literal outside the theme definition and any Tailwind default colour class (`text-gray-500`, `bg-slate-*`, etc.). Every one is a violation.
> 2. Admin uses the indigo ground; storefront uses the greige ground. No dark mode on the storefront.
> 3. `--chalk` is never used for text below 14px.
> 4. `--zari` appears at most twice per viewport.
>
> **Shape**
> 5. Border radius is 2px everywhere. Flag any other radius.
> 6. No box-shadows anywhere. Flag every `shadow-*` class and `box-shadow` rule.
> 7. No gradients.
>
> **Type**
> 8. Confirm the four fonts are self-hosted via `next/font/local` (not loaded from a CDN): the display serif, the UI grotesk, Martian Mono, and Noto Naskh Arabic for Urdu.
> 9. **Every** number, price, measurement, and order number renders in Martian Mono. Flag any numeric data in a proportional font.
> 10. Confirm no FOUT — fonts are declared with a fallback and `next/font`.
> 11. Urdu UI text uses Noto Naskh Arabic, not Nastaliq. Nastaliq only appears in large headings if at all.
>
> Report each with a screenshot reference or file/line. Standard format.

---

# AUDIT C — LAYOUT & ALIGNMENT

**Prompt:**
> Audit layout and alignment across the site. Check the running app at desktop (1440px) and mobile (390px) widths.
>
> 1. **Grid consistency** — content aligns to a consistent grid. Flag misaligned cards, off-baseline text, inconsistent gutters.
> 2. **Spacing scale** — spacing uses a consistent scale, not arbitrary pixel values. Flag one-off margins.
> 3. **Logical properties only** — search for `left`, `right`, `margin-left`, `padding-right`, `ml-`, `pr-`, `text-left`, `text-right`. Every one should be a logical property (`inline-start`/`inline-end`, `ms-`/`me-`, `text-start`/`text-end`). This is what makes RTL work.
> 4. **RTL** — switch to `/ur`. Confirm the whole layout mirrors correctly: nav, cards, forms, tables, the cart drawer. Flag anything that stays left-aligned or overlaps.
> 5. **Alignment of data** — numbers in tables are right-aligned (or decimal-aligned); labels left-aligned. Measurement columns line up.
> 6. **No horizontal scroll** at any breakpoint on any page.
> 7. **Touch targets** on mobile are at least 44px.
>
> Standard format, noting the breakpoint where each issue appears.

---

# AUDIT D — PROTOTYPE FIDELITY (storefront)

**Prompt:**
> I am providing the storefront prototype [attach/link it]. Audit the built storefront against it, screen by screen: home, collection listing, product detail, size guide, custom-measure flow, cart, checkout, order tracking, atelier/about, account.
>
> For each screen report:
> 1. **Structure** — same sections, same order, same hierarchy as the prototype.
> 2. **Spacing & proportion** — does the built screen match the prototype's rhythm, or is it cramped/loose?
> 3. **Component fidelity** — buttons, inputs, cards, the angle switcher, colour swatches, swatch macros match the prototype's design.
> 4. **Interaction** — angle switching (swipe + thumbnails on mobile), instant colour swap, modals opening *over* the page not navigating away, configurator state surviving colour change and refresh.
> 5. **Copy** — the visible text matches the AKS voice in `/docs/AKS_Brand_Foundation.md` (§5 copy deck). Flag any generic or off-voice copy ("Welcome to our store", exclamation marks, banned words from §3).
> 6. **Deviations** — list every place the build differs from the prototype, and say whether it's an improvement, a regression, or a miss.
>
> Where the prototype is silent, fall back to the brand foundation and the design tokens. Standard format, one sub-report per screen.

---

# AUDIT E — FUNCTIONAL: FOUNDATION → COMMERCE (steps 1–34)

Run the exit criterion of each step and report whether it actually holds. **Verify by doing, not by reading the code.**

**Prompt:**
> Verify these behaviours on the running site. For each, perform the action and report PASS/FAIL with what you observed.
>
> **Foundation (1–12)**
> - Sign in with a real email OTP; no demo login works. 2FA enrolment is forced for admin.
> - A MANAGER can edit but every delete is refused **server-side** (test by invoking the action directly, not just checking the hidden button).
> - A TAILOR sees only Production; direct navigation to `/admin/money` is refused.
> - A staff role change writes a correct before/after `audit_logs` row.
> - An illegal `transition()` throws and writes nothing (check the tests pass).
> - An outbox message delivers and retries on failure.
> - `<Money value={4550000}/>` renders `PKR 45,500.00`; `<Measure value={3050}/>` renders `30.5″`.
>
> **Sizing (13–20)**
> - Editing M LENGTH 30→27 shifts the row to 25/26/27/28/29/30 (delta, not scaled).
> - Pinning XXL survives a later base edit.
> - Forking a design's chart leaves the shared default unchanged.
> - `calculateCutSpec` gives a correct spec from a standard size AND from custom measurements, with ease and shrinkage applied, rounded to 0.25″.
>
> **Commerce (21–34)**
> - A published design shows on the storefront with three angles and instant colour switching.
> - Cart survives a browser restart (server-side, not localStorage).
> - Guest checkout completes with a Pakistani address; made-to-measure refuses the 50/50 plan.
> - An order has immutable snapshots — editing the design's price afterward does not change the order.
> - An illegal order transition throws.
> - A manual WhatsApp order is enterable and identical downstream to a web order.
> - A payment webhook replayed 5× creates exactly one payment row.
> - A bank transfer is verifiable from the admin queue.
> - A status change fires a customer email automatically and updates the tracking page.
>
> Standard format. Any FAIL here blocks launch.

---

# AUDIT F — FUNCTIONAL: DESIGN STUDIO → OPERATIONS (steps 35–50)

**Prompt:**
> Verify these on the running site by doing them.
>
> **Design Studio (35–42)**
> - A brief assembles a complete, editable prompt; a routine design takes under 30 seconds and ≤4 decisions.
> - Uploading front + back sketches produces correct roles and lineart derivatives.
> - The hero loop iterates with notes, accumulates cost correctly, and locks on approve.
> - No downstream job can run against an unlocked hero.
> - **The sizing overlay** draws an accurate chalk line on the real render when a length changes — instantly, free, with no face drift. Applying triggers exactly one regeneration.
> - Angles derive from the locked hero; the back follows the back sketch when present; embroidery stays in place across all three.
> - Colourways batch-recolour, write `design_renders` with `isAiGenerated=true`, and appear on the storefront with instant switching.
> - Publish is blocked until the checklist (alt text, AI label, model disclosure, etc.) is complete.
> - An external reference cannot publish without an approved IP attestation.
>
> **Operations (43–50)**
> - Confirming an order reserves metres from a specific lot; a garment is never split across dye lots.
> - Reaching Cutting depletes stock; cancelling before cutting restores it.
> - The production board advances by touch-drag on mobile; Cutting is blocked before MEASUREMENTS_CONFIRMED.
> - The tailor spec sheet prints A4, bilingual, with the correct cut spec and lot code.
> - The Today screen's counts match reality and link to the right filtered lists.
> - Selecting fabric + rates on a design computes total cost and margin automatically; AI cost flows in.
> - Clicking a customer shows her orders; clicking a design shows its margin and fabric consumed.
> - A discount snapshots onto the order and cannot exceed its cap.
> - Try-on: consent is unbundled; three labelled angles return; colour toggle doesn't re-charge; the selfie is hard-deleted at 24h; the store still works when try-on is off.
>
> Standard format.

---

# AUDIT G — CROSS-CUTTING (accessibility, performance, mobile, i18n)

**Prompt:**
> Audit these across the whole site.
>
> **Accessibility**
> 1. Run axe-core on every route; report violations.
> 2. Every image has alt text; every icon-only button has an accessible name.
> 3. Full keyboard operability — the configurator, size guide, and custom-measure flow work without a mouse.
> 4. Colour contrast passes AA (watch chalk-on-greige especially).
> 5. `prefers-reduced-motion` collapses animation to instant.
>
> **Performance (mobile-first — she browses on a phone on a Pakistani network)**
> 6. Storefront routes ship a lean JS bundle; flag any route over budget. The 3D size guide (if built) loads via dynamic import and never counts against the catalog route.
> 7. Images are responsive, lazy-loaded below the fold, and served in modern formats.
> 8. No layout shift on load (CLS).
> 9. Product pages preload the three angles for the current colour.
>
> **Mobile-first**
> 10. Every storefront screen is designed for ~390px first: single column, thumb-reachable primary actions, no hover-only interactions.
> 11. The custom-measure flow is one field per screen, resumable, autosaving.
>
> **i18n / RTL**
> 12. `/ur` renders fully right-to-left with no layout breakage.
> 13. Untranslated Urdu keys fall back to English rather than showing a key or machine translation.
>
> Standard format.

---

# THE REPORT FORMAT (every audit uses this)

```
## AUDIT [letter] — [name]
Verdict: PASS / FAIL / PARTIAL
Checked at: [date, commit hash]

### Failures (must fix)
- [ID] [what's wrong] · file:line or screen · [why it matters] · [suggested fix]

### Partial / warnings
- [ID] [issue] · [context]

### Unverified (could not check)
- [ID] [what] · [why it couldn't be verified]

### Passed
- [brief list of what was confirmed working]

### Summary
X failures, Y warnings, Z unverified. Top 3 to fix first: …
```

---

# HOW TO RUN THE WHOLE THING

1. Run **Audit A first** (rules compliance). Fix every FAIL before anything else — these are structural.
2. Run **B and C** (visual, layout) — cheap to check, high impact.
3. Run **D** against your prototype.
4. Run **E and F** (functional) — the longest; do them when the build is far enough along.
5. Run **G** last (cross-cutting).
6. Keep each report in `/docs/audits/` with the commit hash, so you can see what regressed between runs.

**Re-run an audit after fixing its fails — never assume a fix worked.** And run A, C, and G again before you switch the domain to the new build; those three catch the issues that hurt real customers.
