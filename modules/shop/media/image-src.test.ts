import { describe, expect, it } from "vitest";

import { imageNeedsOptimizerBypass, optimizerImageSrc } from "./image-src";

describe("optimizerImageSrc", () => {
  it("makes same-origin asset URLs root-relative", () => {
    expect(
      optimizerImageSrc(
        "https://www.aks-atelier.com/api/assets/serve?key=catalogue%2Fa.jpg",
      ),
    ).toBe("/api/assets/serve?key=catalogue%2Fa.jpg");
    expect(optimizerImageSrc("/brand/aks-logo.png")).toBe(
      "/brand/aks-logo.png",
    );
  });

  it("leaves external hosts absolute so they are not sent through the optimizer", () => {
    const signed = "https://example.r2.cloudflarestorage.com/bucket/a.jpg?X-Amz-Signature=abc";
    expect(optimizerImageSrc(signed)).toBe(signed);
    expect(imageNeedsOptimizerBypass(signed)).toBe(true);
    expect(imageNeedsOptimizerBypass("/api/assets/serve?key=a")).toBe(false);
  });
});
