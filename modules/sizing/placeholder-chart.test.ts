import { describe, expect, it } from "vitest";

import { DEFAULT_SIZE_BLOCK_SEEDS, looksLikePlaceholderChart } from "@aks/shared";

describe("placeholder house charts", () => {
  it("flags the seed fallback, where every girth is the same number", () => {
    expect(
      looksLikePlaceholderChart([
        { measurementKey: "BUST", baseValue: 3600 },
        { measurementKey: "WAIST", baseValue: 3600 },
        { measurementKey: "HIP", baseValue: 3600 },
        { measurementKey: "LENGTH", baseValue: 3800 },
      ]),
    ).toBe(true);
  });

  it("accepts a real block, where the girths differ", () => {
    expect(
      looksLikePlaceholderChart([
        { measurementKey: "BUST", baseValue: 4000 },
        { measurementKey: "WAIST", baseValue: 3950 },
        { measurementKey: "HIP", baseValue: 4300 },
      ]),
    ).toBe(false);
  });

  it("does not guess from a single girth", () => {
    expect(
      looksLikePlaceholderChart([{ measurementKey: "WAIST", baseValue: 3200 }]),
    ).toBe(false);
  });

  it("reports how much of the house is still filler", () => {
    const withRows = DEFAULT_SIZE_BLOCK_SEEDS.filter((b) => b.rows.length > 0);
    const real = withRows.filter((b) => !looksLikePlaceholderChart(b.rows));
    // The researched blocks (kameez, kurti, pant, palazzo, lehenga) are real;
    // this asserts the detector finds them rather than flagging everything.
    expect(real.length).toBeGreaterThanOrEqual(4);
    expect(real.length).toBeLessThan(withRows.length);
  });
});
