# AKS — BUILD ROADMAP
### The complete build order. Work top to bottom.

> **Cursor: read this first.** Build these steps **one at a time, in order.** After each step, STOP, and wait for me to confirm the exit criterion works before starting the next. Do NOT build ahead. Do NOT do multiple steps in one response. Each step's full prompt and exit criterion is in the matching `AKS_BUILD_0X` file in `/docs/`. Follow `.cursorrules` on every step.

---

## PHASE 1 — FOUNDATION  (file: AKS_BUILD_01)
- [ ] 1. Repo skeleton & tooling
- [ ] 2. Reference repo & docs
- [ ] 3. Database connection & migrations
- [ ] 4. Core schema (identity & platform)
- [ ] 5. Design tokens & fonts
- [ ] 6. Core primitives (Money, Measure, etc.)
- [ ] 7. transition() & event pattern
- [ ] 8. Outbox & worker skeleton
- [ ] 9. Asset storage (R2)
- [ ] 10. Authentication (passwordless OTP + 2FA)
- [ ] 11. RBAC (permissions, roles, enforcement)
- [ ] 12. Admin shell & staff management

## PHASE 2 — SIZING ENGINE  (file: AKS_BUILD_02)
- [ ] 13. Categories & measurement keys
- [ ] 14. Size blocks schema & seed
- [ ] 15. Grading engine (pure functions + tests)
- [ ] 16. Size chart editor UI
- [ ] 17. Pinning, fork-on-edit, revert
- [ ] 18. Fit profiles (ease)
- [ ] 19. Fabrics (minimal) & archetypes
- [ ] 20. Cut-spec calculator

## PHASE 3 — COMMERCE  (file: AKS_BUILD_03)
- [ ] 21. Catalog schema & admin CRUD
- [ ] 22. Storefront shell (from prototype)
- [ ] 23. Collections & filtering
- [ ] 24. Product detail page
- [ ] 25. Size selection & guide
- [ ] 26. Custom measurement flow
- [ ] 27. Cart
- [ ] 28. Checkout & Pakistani address
- [ ] 29. Orders schema & state machine
- [ ] 30. Admin order list & detail
- [ ] 31. Manual order entry
- [ ] 32. Payments: interface & Safepay
- [ ] 33. Bank transfer & COD
- [ ] 34. Status pipeline & automatic notifications
      ← ★ WORKING BUSINESS. Switch the domain here.

## PHASE 4 — DESIGN STUDIO  (file: AKS_BUILD_04)
- [ ] 35. Studio settings & prompt templates
- [ ] 36. fal.ai adapter & job queue
- [ ] 37. Design brief (dropdown-driven)
- [ ] 38. Input set & sketch preprocessing
- [ ] 39. Hero generation loop
- [ ] 40. Calibrated sizing overlay
- [ ] 41. Angles
- [ ] 42. Colourways & publish

## PHASE 5 — OPERATIONS & GROWTH  (file: AKS_BUILD_05)
- [ ] 43. Fabric lots & stock automation
- [ ] 44. Production board
- [ ] 45. Tailor spec sheet
- [ ] 46. Today screen
- [ ] 47. Money
- [ ] 48. Insights & related panels
- [ ] 49. Discounts
- [ ] 50. Try-on (Reflection)

## PHASE 6 — TRUST & GROWTH  (file: AKS_Trust_And_Growth_Layer)
- [ ] T1. Measurement confidence
- [ ] T3. WhatsApp concierge
- [ ] T5. Visible workshop
- [ ] T2. Fit guarantee & remake
- [ ] T4. Social proof & fit reviews
- [ ] T6. Repeat-order / measurement moat
- [ ] T7. Occasion-first & fabric-first browse

---

## HOW WE WORK EACH STEP
1. I open a fresh Cursor chat and say the step number.
2. Cursor reads the matching prompt in `/docs/AKS_BUILD_0X` and implements ONLY that step.
3. Cursor tells me how to verify it.
4. I check it works, then tick the box here.
5. New chat, next step.

**Never two steps at once. Never proceed with a known defect.**
