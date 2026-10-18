import { describe, expect, it } from "vitest";

import { rtwReceiveDeductionCopy } from "./rtw-receive-confirm";

describe("rtwReceiveDeductionCopy", () => {
  it("states metres as costing times pieces", () => {
    expect(rtwReceiveDeductionCopy(2, 350)).toBe(
      "Receiving 2 pieces deducts 7.0 m of cloth (3.5 m each).",
    );
  });

  it("uses the singular when one piece is received", () => {
    expect(rtwReceiveDeductionCopy(1, 100)).toBe(
      "Receiving 1 piece deducts 1.0 m of cloth (1.0 m each).",
    );
  });

  it("says the receive will be refused when costing metres are unset", () => {
    expect(rtwReceiveDeductionCopy(3, 0)).toContain("will be refused");
  });
});
