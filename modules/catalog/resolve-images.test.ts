import { describe, expect, it } from "vitest";

import {
  buildImageTripleFromRows,
  type RenderRow,
} from "./resolve-images";

describe("buildImageTripleFromRows", () => {
  const rows: RenderRow[] = [
    {
      angle: "FRONT",
      assetId: "a1",
      altText: "Front view",
      r2Key: "renders/front.jpg",
      sortOrder: 0,
      isAiGenerated: true,
    },
    {
      angle: "THREE_QUARTER",
      assetId: "a2",
      altText: "Three-quarter view",
      r2Key: "renders/three.jpg",
      sortOrder: 1,
      isAiGenerated: true,
    },
    {
      angle: "BACK",
      assetId: "a3",
      altText: "Back view",
      r2Key: "renders/back.jpg",
      sortOrder: 2,
      isAiGenerated: true,
    },
  ];

  it("returns FRONT, THREE_QUARTER, and BACK keys with asset metadata", () => {
    const triple = buildImageTripleFromRows(rows);

    expect(Object.keys(triple).sort()).toEqual([
      "BACK",
      "FRONT",
      "THREE_QUARTER",
    ]);
    expect(triple.FRONT).toEqual({
      assetId: "a1",
      r2Key: "renders/front.jpg",
      altText: "Front view",
      url: null,
      isAiGenerated: true,
    });
    expect(triple.THREE_QUARTER?.altText).toBe("Three-quarter view");
    expect(triple.BACK?.assetId).toBe("a3");
  });

  it("ignores DETAIL angle and keeps first row per gallery angle", () => {
    const triple = buildImageTripleFromRows([
      ...rows,
      {
        angle: "DETAIL",
        assetId: "detail",
        altText: "Detail",
        r2Key: "renders/detail.jpg",
        sortOrder: 3,
      },
      {
        angle: "FRONT",
        assetId: "a1b",
        altText: "Second front",
        r2Key: "renders/front-2.jpg",
        sortOrder: 4,
      },
    ]);

    expect(triple.FRONT?.assetId).toBe("a1");
    expect(triple).not.toHaveProperty("DETAIL");
  });

  it("fills missing angles with null", () => {
    const triple = buildImageTripleFromRows([rows[0]!]);

    expect(triple.FRONT).not.toBeNull();
    expect(triple.THREE_QUARTER).toBeNull();
    expect(triple.BACK).toBeNull();
  });
});

describe("resolveColourwayId helper", () => {
  it("resolves slug, id, and default", async () => {
    const { resolveColourwayId } = await import("./types");
    const colourways = [
      {
        id: "cw-1",
        slug: "ivory",
        name: "Ivory",
        nameUr: "",
        fabricId: "f1",
        fabricName: "Lawn",
        hexApproximation: "#fff",
        priceDeltaMinor: 0,
        isDefault: true,
        sortOrder: 0,
        swatch: null,
      },
      {
        id: "cw-2",
        slug: "rose",
        name: "Rose",
        nameUr: "",
        fabricId: "f1",
        fabricName: "Lawn",
        hexApproximation: "#fcc",
        priceDeltaMinor: 50000,
        isDefault: false,
        sortOrder: 1,
        swatch: null,
      },
    ];

    expect(resolveColourwayId("rose", colourways, "cw-1")).toBe("cw-2");
    expect(resolveColourwayId("cw-2", colourways, "cw-1")).toBe("cw-2");
    expect(resolveColourwayId(null, colourways, "cw-1")).toBe("cw-1");
    expect(resolveColourwayId("missing", colourways, "cw-1")).toBe("cw-1");
  });
});
