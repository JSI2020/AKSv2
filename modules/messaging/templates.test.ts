import { describe, expect, it } from "vitest";

import { renderTemplate } from "./templates";

describe("message templates", () => {
  it("renders variables in subject and body", () => {
    const out = renderTemplate("Hello {{customerName}}, order {{orderNumber}}", {
      customerName: "Sara",
      orderNumber: "AKS-2026-00001",
    });
    expect(out).toBe("Hello Sara, order AKS-2026-00001");
  });
});
