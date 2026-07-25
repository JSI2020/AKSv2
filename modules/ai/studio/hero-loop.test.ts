import { describe, expect, it } from "vitest";

import {
  HeuristicPromptModifier,
  applyNotesToPrompt,
} from "@/modules/ai/prompts/notes-to-delta";
import { DESIGN_STATUS_ALLOW } from "@aks/shared";

describe("HeuristicPromptModifier", () => {
  it("appends structured revision block and stores resolved prompt", async () => {
    const mod = new HeuristicPromptModifier();
    const result = await mod.apply({
      basePrompt: "Photorealistic kameez.",
      notes: "sleeves too short; fabric should be matte lawn",
    });

    expect(result.source).toBe("heuristic");
    expect(result.deltas).toHaveLength(2);
    expect(result.resolvedPrompt).toContain("Photorealistic kameez.");
    expect(result.resolvedPrompt).toContain("Revision notes:");
    expect(result.resolvedPrompt).toContain("sleeves too short");
    expect(result.resolvedPrompt).not.toBe("sleeves too short");
  });

  it("returns base prompt unchanged when notes empty", async () => {
    const result = await applyNotesToPrompt(
      { basePrompt: "Base.", notes: "  " },
      new HeuristicPromptModifier(),
    );
    expect(result.resolvedPrompt).toBe("Base.");
    expect(result.deltas).toHaveLength(0);
  });
});

describe("DESIGN_STATUS_ALLOW hero loop", () => {
  it("allows hero generating ↔ review cycles", () => {
    expect(DESIGN_STATUS_ALLOW.INPUTS_UPLOADED).toContain("HERO_GENERATING");
    expect(DESIGN_STATUS_ALLOW.HERO_GENERATING).toContain("HERO_REVIEW");
    expect(DESIGN_STATUS_ALLOW.HERO_REVIEW).toContain("HERO_GENERATING");
    expect(DESIGN_STATUS_ALLOW.HERO_REVIEW).toContain("HERO_LOCKED");
  });

  it("blocks downstream stages until hero locked", () => {
    expect(DESIGN_STATUS_ALLOW.INPUTS_UPLOADED).not.toContain("ANGLES_GENERATING");
    expect(DESIGN_STATUS_ALLOW.HERO_REVIEW).not.toContain("SIZING");
    expect(DESIGN_STATUS_ALLOW.HERO_LOCKED).toContain("SIZING");
  });
});
