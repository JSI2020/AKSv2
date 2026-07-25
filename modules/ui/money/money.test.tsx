import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { formatMoney, Money } from "./money";

afterEach(() => {
  cleanup();
});

describe("formatMoney", () => {
  it("formats 4550000 paisa as PKR 45,500.00", () => {
    expect(formatMoney(4550000)).toBe("PKR 45,500.00");
  });

  it("formats zero and single paisa", () => {
    expect(formatMoney(0)).toBe("PKR 0.00");
    expect(formatMoney(1)).toBe("PKR 0.01");
    expect(formatMoney(99)).toBe("PKR 0.99");
    expect(formatMoney(100)).toBe("PKR 1.00");
  });

  it("formats negative amounts", () => {
    expect(formatMoney(-4550000)).toBe("-PKR 45,500.00");
  });

  it("rejects non-integers (no float money)", () => {
    expect(() => formatMoney(10.5)).toThrow(/integer/);
  });
});

describe("<Money />", () => {
  it("renders the exit-criterion string", () => {
    render(<Money value={4550000} currency="PKR" />);
    expect(screen.getByText("PKR 45,500.00")).toBeTruthy();
  });
});
