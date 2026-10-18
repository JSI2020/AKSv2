import { describe, expect, it } from "vitest";

import { whatsappGraphError } from "./whatsapp";

describe("whatsappGraphError", () => {
  it("keeps the Cloud API code and subcode and drops a token-sized string", () => {
    const line = whatsappGraphError(401, {
      error: {
        message: "Authentication Error",
        type: "OAuthException",
        code: 190,
        error_subcode: 467,
        fbtrace_id: "A2lw3fHtgs_7yDijRr8KpaA",
      },
    });
    expect(line).toContain("Authentication Error");
    expect(line).toContain("code 190");
    expect(line).toContain("subcode 467");
    expect(line).toContain("OAuthException");
    expect(line).toContain("fbtrace A2lw3fHtgs_7yDijRr8KpaA");
  });

  it("redacts a token-length string if Meta echoes one", () => {
    const token = `EAA${"a".repeat(90)}`;
    const line = whatsappGraphError(401, {
      error: { message: `bad ${token}`, code: 190 },
    });
    expect(line).toContain("[redacted]");
    expect(line).not.toContain(token);
  });
});
