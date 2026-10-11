import { describe, expect, it } from "vitest";

import {
  buildPrompt,
  INPUT_SOURCE_TABS,
  MANNEQUIN_NEGATIVE_PROMPT,
  promptModeFromSavedPrompt,
  resolvePromptMode,
  type PromptMode,
} from "./prompt-builder";

describe("mannequin mode", () => {
  it("is offered as a starting point", () => {
    expect(INPUT_SOURCE_TABS.map((t) => t.id)).toContain("mannequin");
  });

  it("locks the garment, presses it, and removes the mannequin", () => {
    const built = buildPrompt({ mode: "mannequin" });

    expect(built.mode).toBe("mannequin");
    expect(built.prompt).toMatch(/MANNEQUIN \/ DRESS FORM/);
    expect(built.prompt).toMatch(/Reproduce the garment EXACTLY/);
    expect(built.prompt).toMatch(/GARMENT PRESSING/);
    expect(built.prompt).toMatch(/Remove the mannequin, dress form/);
    expect(built.prompt).toMatch(/GARMENT LOCK/);
    expect(built.negativePrompt).toBe(MANNEQUIN_NEGATIVE_PROMPT);
    expect(built.negativePrompt).toMatch(/creases/);
    expect(built.negativePrompt).toMatch(/mannequin/);
  });

  it("treats notes and colours as references, never as design changes", () => {
    const built = buildPrompt({
      mode: "mannequin",
      description: "keep the cloth originally same",
      shirtColour: "sky blue",
    });

    expect(built.prompt).toMatch(
      /Styling \/ shot note \(the dress itself must not change\): keep the cloth originally same/,
    );
    expect(built.prompt).toMatch(
      /Colour reference to reproduce accurately \(do not recolour\): Shirt\/kameez: sky blue colour/,
    );
  });

  it("keeps the dress and pressing on a background refine", () => {
    const built = buildPrompt({
      mode: "mannequin",
      feedback: "change the background to a garden",
      keepPose: true,
    });

    expect(built.prompt).toMatch(/BACKGROUND CHANGE/);
    expect(built.prompt).toMatch(/same dress/);
    expect(built.prompt).toMatch(/GARMENT PRESSING/);
  });

  it("is respected by resolvePromptMode", () => {
    expect(
      resolvePromptMode({ sourceMode: "mannequin", oldDesignUrl: "x" }),
    ).toBe("mannequin");
  });
});

describe("promptModeFromSavedPrompt", () => {
  const modes: PromptMode[] = [
    "sketch",
    "old-design",
    "description",
    "repose",
    "mannequin",
  ];

  it.each(modes)("recovers %s from its own prompt", (mode) => {
    expect(promptModeFromSavedPrompt(buildPrompt({ mode }).prompt)).toBe(mode);
  });

  it("returns null for unknown or empty prompts", () => {
    expect(promptModeFromSavedPrompt("")).toBeNull();
    expect(promptModeFromSavedPrompt(null)).toBeNull();
    expect(promptModeFromSavedPrompt("some other prompt")).toBeNull();
  });
});
