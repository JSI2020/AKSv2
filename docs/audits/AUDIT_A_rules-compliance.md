## AUDIT A — RULES COMPLIANCE (the non-negotiables)
Verdict: **PASS** (with warnings)
Checked at: 2026-07-26 (re-audit after fixes), base commit `565f7ae` + uncommitted Audit A remediation.

Method: codebase search re-verify of prior FAIL IDs + unit tests (`modules/sizing/engine/resolve-chart.test.ts`, `modules/ui/money/money.test.tsx` — 13/13 passed). Demo seed not re-executed in this pass (Postgres not reachable locally). No production runtime OTP/admin session exercised.

---

### Failures (must fix)

None.

| Prior ID | Resolution |
|----------|------------|
| **A2-MONEY-01** | `design-costing-panel.tsx` option labels use `formatMoney()` (Money module helper). |
| **A3-STATUS-01** | `blockProductionJobAction` uses `transitionProductionJobStatus` → entity `production_job_status` + `PRODUCTION_JOB_STATUS_ALLOW`. |
| **A3-STATUS-02** | `seed-demo.ts` inserts designs/orders as `DRAFT`, then `transition()` / `transitionOrder` to target status. |
| **A5-EVENTS-01** | `seed-demo.ts` no longer deletes `order_events`; demo order clears leave events as orphans. |
| **A7-CREDS-01** | Removed `readBankTransferConfigOrDefaults`; pay page uses `readBankTransferConfigOrNull` and fails closed with a message when env is incomplete. |
| **A10-SDK-01** | Resend SDK only in `modules/messaging/providers/resend/`; auth/messaging handlers import the adapter. |

---

### Partial / warnings

- **[A2-DISP-01]** Input boundary `/100` for editing · measure/order forms — OK if storage stays integer; read-only display should stay on `<Money>` / `<Measure>`.
- **[A3-STATUS-03]** Status columns updated without `transition()` on entities **not** registered · fabric lot / cart / user DISABLED / payments / generation / tryon — decide registry scope vs documented exceptions.
- **[A5-TEST-01]** Test suites delete `orderEvents` for cleanup · acceptable in tests only.
- **[A6-RBAC-01]** Customer-facing mutations omit `requirePermission()` · correct for guests; rule wording should distinguish staff vs customer gates.
- **[A9-OUTBOX-01]** External email send is in outbox handlers behind `providers/resend` (resolved for A10).

---

### Unverified (could not check)

- **[A6-ENUM]** Exhaustive proof that *every* admin mutation calls `requirePermission()` · sampled; not mechanically parsed.
- **[A8-RUNTIME]** Live `/admin` OTP reject unknown emails · code-path only.
- **[A3-RUNTIME]** Illegal `transition()` on a live DB · unit tests exist; live probe not re-run.
- **[A3-SEED-RUNTIME]** `npm run db:seed:demo` after transition rewrite · DB was down (`ECONNREFUSED`) during re-audit.

---

### Passed

- Prior PASS items still hold (money/measure integers, snapshots, audit insert-only, passwordless, no hardcoded OTP, Fal/Safepay under providers, sizing engine + `does_not_scale_proportionally`).
- Resend confined to `modules/messaging/providers/resend/`.
- Bank transfer has no hardcoded account/IBAN defaults.
- Production workflow block goes through `transition()`.

---

### Summary

**0 failures**, **5 warnings**, **4 unverified**.

Audit A exit criteria for failures are met. Proceed to **Audit B** (visual tokens) in a separate chat.
