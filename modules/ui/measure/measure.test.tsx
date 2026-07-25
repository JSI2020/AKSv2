import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { formatMeasure, Measure } from "./measure";

afterEach(() => {
  cleanup();
});

describe("formatMeasure", () => {
  it("formats 3050 hundredths as 30.5″", () => {
    expect(formatMeasure(3050)).toBe("30.5″");
  });

  it("trims trailing zeros and keeps two-place fractions", () => {
    expect(formatMeasure(3000)).toBe("30″");
    expect(formatMeasure(3010)).toBe("30.1″");
    expect(formatMeasure(3015)).toBe("30.15″");
  });

  it("formats negative measures", () => {
    expect(formatMeasure(-3050)).toBe("-30.5″");
  });

  it("formats centimetres for display only", () => {
    // 10″ = 1000 hundredths → 25.4 cm → "25.4 cm"
    expect(formatMeasure(1000, "cm")).toBe("25.4 cm");
  });
});

describe("<Measure />", () => {
  it("renders the exit-criterion string", () => {
    render(<Measure value={3050} unit="in" />);
    expect(screen.getByText("30.5″")).toBeTruthy();
  });
});
