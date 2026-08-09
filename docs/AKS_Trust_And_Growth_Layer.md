# AKS — THE TRUST & GROWTH LAYER
### The functions that make the machinery actually sell

> **Why this exists:** the seven build tools cover the *factory and shopfront* — how a dress is designed, sized, made, and sold. They under-build the hardest part of this specific business: **getting an anxious woman to pay for a dress that doesn't exist yet, will take weeks, and can't be tried on.**
>
> Made-to-order is a **trust business**. This document lists the functions that build that trust — and the ones that turn a first buyer into a repeat one. Build them as standalone tools in the same style, then compose.

---

## THE CORE IDEA, RESTATED

AKS removes the two compromises every woman makes buying clothes:
1. **The fit is wrong** — standard sizes fit no one. → made-to-measure.
2. **The style forces one culture** — East or West, pick one. → East-meets-West, modestly.

Everything serves those two. But the *product she's actually buying is trust in a promise*, because she pays before the garment exists. The functions below exist to make that promise believable, and to make the second purchase effortless.

---

## THE SEVEN TRUST & GROWTH FUNCTIONS

| # | Function | Solves | Type |
|---|---|---|---|
| T1 | **Measurement Confidence** | "What if I measure myself wrong?" | Guide + tool |
| T2 | **Fit Guarantee & Remake Flow** | "What if it doesn't fit?" | Workflow |
| T3 | **WhatsApp Concierge** | "Can I ask before I pay PKR 40,000?" | Channel |
| T4 | **Social Proof & Fit Reviews** | "Does it work on a body like mine?" | Content engine |
| T5 | **The Visible Workshop** | "Is my dress actually being made?" | Trust feed |
| T6 | **Repeat-Order / Measurement Moat** | Effortless second purchase | Retention |
| T7 | **Occasion-First & Fabric-First Browse** | How she actually shops | Discovery |

---

# T1 — MEASUREMENT CONFIDENCE

**The problem it solves:** her measurements are the single point of failure. If she measures wrong, the dress fails — nobody's fault, but your refund. This is the highest-leverage trust function in the whole business, and the current plan treats measuring as a plain form.

**Functions:**
- **Video-guided measuring** — a short clip per measurement showing exactly how to hold the tape, not a text hint. This alone reduces misfits more than anything else.
- **"Measure a garment you own" mode** — many women can't measure their body confidently but *can* lay a well-fitting kameez flat and measure that. Offer both paths; convert garment measurements to body measurements behind the scenes.
- **Plausibility coaching** — the cross-field checks we specced, but framed as help: "That waist-to-hip looks unusual — here's how to check."
- **A "not sure? send a photo" escape** into T3 (concierge).
- **Confidence score** — quietly flag orders where measurements look risky, so the workshop double-checks before cutting.

**Standalone build:** a self-contained measuring tool — pick a garment type, go measurement by measurement with video, validate, output a saved profile. No cart needed. Testable alone.

**Prompt seed:** *"Build a guided measurement tool: select garment type, then one measurement per screen with a demo video slot, a body-measurement path and a 'measure a garment you own' path, live plausibility validation with helpful prompts, autosave, and a saved measurement profile as output. No AI. Pure UX and validation."*

---

# T2 — FIT GUARANTEE & REMAKE FLOW

**The problem it solves:** sometimes it won't fit, and it's genuinely no one's fault. How you handle that misfit is existential for a made-to-measure brand — generous enough to make buying safe, bounded enough to survive.

**Functions:**
- **A first-order fit promise**, surfaced at checkout: if the fit is off, we alter or remake. (Business decision; the site must carry it.)
- **Alteration request intake** — she reports what's off (too tight at the shoulder, too long), with photos.
- **Fault attribution** — our error (free remake), her measurement (paid or goodwill alteration), fabric defect. Drives cost and tone.
- **Remake as a linked order** — a new production job tied to the original, using the corrected measurements, tracked like any order.
- **Feeds T4 and the size engine** — every alteration is data about where garments run off.
- **Cost of remakes booked into margin** — so the guarantee is survivable, not a hole.

**Standalone build:** a workflow tool — report a fit issue → attribute fault → generate a linked remake job → track it. Works against a seeded order.

**Prompt seed:** *"Build a fit-issue and remake workflow: a customer reports a fit problem with photos and affected areas; admin attributes fault (our error / customer measurement / fabric); the system creates a linked remake production job with corrected measurements and tracks it to completion; the remake cost is recorded. Standalone against a seeded order."*

---

# T3 — WHATSAPP CONCIERGE

**The problem it solves:** a PKR 40,000 festive purchase is considered and often collective. She wants to ask a human before paying. In this market WhatsApp *is* the channel — this is likely the single highest-converting function and it's barely in the current plan.

**Functions:**
- **A concierge inbox** — WhatsApp conversations in one admin place, linked to the customer and any order.
- **"Send us a photo for size help"** — a human (or later, assisted) sizing consult before purchase.
- **Pre-purchase Q&A** — fabric, delivery-by-date, customisation questions, answered in-thread.
- **Convert a chat into a manual order** — she decides in WhatsApp, you place the order (ties into Commerce's manual-order entry).
- **Templated + free-form** within the 24-hour window rules.
- **Styling / occasion advice** — the atelier relationship, digitised.

**Standalone build:** a WhatsApp inbox tool — receive, thread by customer, reply, and a "create order from this chat" action. Uses the notifications service.

**Prompt seed:** *"Build a WhatsApp concierge inbox: receive and thread messages by customer via the WhatsApp Cloud API, reply within-session, attach a conversation to a customer/order, and a 'create order from this conversation' action. Respect the 24-hour session and template rules. Verify current WhatsApp Cloud API rules before wiring."*

---

# T4 — SOCIAL PROOF & FIT REVIEWS

**The problem it solves:** an anxious first buyer is convinced by *other real women*, not by hero images. And she needs proof it works on a body like hers.

**Functions:**
- **Customer photo reviews** — real garments on real bodies, moderated.
- **Fit-specific reviews** — structured: "true to size", "ran tight on the shoulder", plus her height/size so others can compare. This is more useful than star ratings for this buyer.
- **Body-context captions** — "she's 5'4″, ordered custom" — the detail that converts.
- **Aggregate fit signal per design** — "runs true to size · 24 reviews", shown on the product page, and fed back to tune the size blocks.
- **Verified purchase only** — reviews require a real delivered order.
- **Moderation** — through the shared moderation queue.

**Standalone build:** a review capture + display tool — post-delivery request, structured fit form with photo, moderation, and a product-page display block with the aggregate fit summary. Against seeded orders.

**Prompt seed:** *"Build a fit-review system: request a review after delivery; capture a star rating, a structured fit response (too small / true / too large, plus which area), the reviewer's height and size, an optional photo, and free text; moderate; and render a product-page block showing photos and an aggregate 'runs true to size' summary. Verified purchase only."*

---

# T5 — THE VISIBLE WORKSHOP

**The problem it solves:** seeing *her* fabric being cut is the most reassuring thing you can show someone waiting three weeks. Most brands hide the workshop; showing it is the whole trust play, and it's underweighted in the current plan.

**Functions:**
- **Production photo feed on her order** — a photo at cutting, at embroidery, at QC, pushed to her order view and optionally WhatsApp.
- **Real workshop language** — "your karigar is cutting" not "in production" (already in the brand voice — this is where it lives).
- **The story, not just the status** — each stage with a line of context, so waiting feels like anticipation, not silence.
- **Opt-in delight** — a short clip of the embroidery being done, for higher-value orders.
- **Turns the wait into the product** — the weeks become part of what she's buying, not a cost.

**Standalone build:** extends order tracking — admin uploads a stage photo, it appears on the customer timeline with workshop-voice copy and an optional WhatsApp push. Against a seeded order.

**Prompt seed:** *"Build a production photo feed: admin uploads a photo at any production stage and marks it customer-visible; it appears on the customer's order timeline with warm workshop-voice copy and an optional WhatsApp notification. Standalone against a seeded order."*

---

# T6 — REPEAT-ORDER / MEASUREMENT MOAT

**The problem it solves:** the plan optimises the *first* purchase and under-builds the *second* — where the real lifetime value is. Once she's measured, reordering should be almost frictionless, and that measurement profile is a genuine retention moat.

**Functions:**
- **Saved measurement profiles** — reusable across every future order, one tap.
- **"You're already measured"** — the reorder pitch: this dress is 30 seconds away.
- **One-tap reorder / re-buy in another colour or fabric.**
- **Profiles for others** — she measures her mother, her sister; gifting and family buying.
- **Fit-learning over time** — if an alteration corrected her profile, future orders use the corrected numbers automatically.
- **Gentle re-engagement** — new arrivals in fabrics/occasions she's bought, via the notification service.

**Standalone build:** a profile + reorder tool — manage saved profiles (self and others), and a one-tap "order this design using [profile]" flow. Against seeded designs and a customer.

**Prompt seed:** *"Build saved measurement profiles and one-tap reorder: a customer manages multiple named measurement profiles (herself and family), and can order any design using a saved profile in one step, with corrections from past alterations applied automatically. Standalone against seeded designs."*

---

# T7 — OCCASION-FIRST & FABRIC-FIRST BROWSE

**The problem it solves:** she doesn't browse by "category." She thinks *"I have a mehndi in three weeks"* or falls in love with a *fabric*. The current catalog is attribute-filtered; these are how she actually shops.

**Functions:**
- **Occasion-first entry** — "I have a [mehndi / walima / Eid] on [date]" → shows only designs that can be **made and delivered in time** (lead-time-aware, honest about the countdown).
- **Deliver-by-date filtering** — the single most useful filter for festive/bridal buying, and almost no one offers it.
- **Fabric-first browse** — "show me everything in this jamawar." She falls for cloth before design.
- **Countdown urgency that's real** — driven by actual lead times, not fake scarcity.
- **Made-to-order as anti-waste** — surface the sustainability truth (nothing cut until sold, no deadstock) as a browse-level story; the conscious diaspora cares, it's true, and it's free.

**Standalone build:** a discovery tool — occasion + date input → lead-time-filtered results; and a fabric-led browse mode. Against seeded designs with lead times.

**Prompt seed:** *"Build occasion-first and fabric-first discovery: an entry where the user picks an occasion and a date, and sees only designs that can be delivered in time (lead-time aware); and a fabric-led browse where selecting a fabric shows every design available in it. Standalone against seeded designs with lead times and fabric links."*

---

## HOW THIS SITS WITH THE SEVEN BUILD TOOLS

These aren't a replacement — they're the layer that makes the seven *sell*. Mapping:

| Trust function | Builds on / connects to |
|---|---|
| T1 Measurement Confidence | Sizing Studio |
| T2 Fit Guarantee & Remake | Inventory+Production, Commerce Core |
| T3 WhatsApp Concierge | Notifications, Commerce Core (manual order) |
| T4 Social Proof | Commerce Core, Sizing (feeds size tuning) |
| T5 Visible Workshop | Commerce Core (order tracking), Notifications |
| T6 Repeat-Order Moat | Sizing Studio, Commerce Core |
| T7 Occasion/Fabric Browse | Money Engine (lead time), Commerce Core, Inventory |

---

## WHAT I'D CHALLENGE IN THE ORIGINAL PLAN

Stated plainly, because it affects where you spend effort:

- **Defer the 3D size guide hard.** Expensive, heavy on mobile, and a great measuring *video* (T1) plus the 2D overlay likely converts better for a fraction of the cost and risk.
- **Try-on is lower-value than it feels.** Dazzling in a demo, but for this buyer *"will it fit"* (T1, T2, T4) beats *"what do I look like."* Don't let the shiny feature crowd out the measuring guide.
- **The second purchase is under-built.** The measurement moat (T6) is where lifetime value lives, and it's nearly free once measuring exists. Weight it.
- **WhatsApp (T3) is probably your highest-converting single feature** and it's currently a thin slice. Consider promoting it.

---

## PRIORITISED ORDER (by trust-per-effort)

1. **T1 Measurement Confidence** — reduces misfits, the root risk. Build first.
2. **T3 WhatsApp Concierge** — highest conversion lever in this market.
3. **T5 Visible Workshop** — cheapest big trust win; extends tracking.
4. **T2 Fit Guarantee & Remake** — makes buying safe; existential to get right.
5. **T4 Social Proof** — compounds as orders accumulate.
6. **T6 Repeat-Order Moat** — unlocks lifetime value once T1 exists.
7. **T7 Occasion/Fabric Browse** — discovery polish; valuable but later.

---

## THE ONE-LINER

You've built a superb factory and shopfront. This layer is the **trust bridge** — the guarantee, the human on WhatsApp, the visible workshop, the proof from real women, and the graceful handling of the misfit — plus the **measurement moat** that makes her second order effortless. That bridge is what actually makes the machinery sell.
