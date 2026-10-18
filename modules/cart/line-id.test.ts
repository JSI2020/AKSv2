import { describe, expect, it } from "vitest";

import { isPersistedCartLineId } from "./line-id";

describe("isPersistedCartLineId", () => {
  it("accepts a uuid line id", () => {
    expect(
      isPersistedCartLineId("01a131ce-78a3-733f-9f74-091ef42ee503"),
    ).toBe(true);
  });

  it("rejects the temporary id used before the server saves the line", () => {
    expect(isPersistedCartLineId("optimistic-1791836945816")).toBe(false);
  });
});
