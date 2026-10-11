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

  it("first pass copies the mannequin's stance instead of a random pose", () => {
    for (let i = 0; i < 10; i++) {
      const built = buildPrompt({ mode: "mannequin" });
      expect(built.poseId).toBeUndefined();
      expect(built.prompt).toMatch(/match the source photo exactly/);
      expect(built.prompt).not.toMatch(/never a stiff mannequin stand/);
    }
  });

  it("uses an explicitly picked pose instead of copying the source", () => {
    const built = buildPrompt({ mode: "mannequin", poseId: "front-relaxed" });
    expect(built.poseId).toBe("front-relaxed");
    expect(built.prompt).not.toMatch(/match the source photo exactly/);
  });

  it("keeps the current pose on a plain refine", () => {
    const built = buildPrompt({
      mode: "mannequin",
      feedback: "warmer lighting",
      keepPose: true,
    });
    expect(built.prompt).toMatch(/Pose continuity/);
    expect(built.prompt).not.toMatch(/match the source photo exactly/);
  });

  it("allows a clean studio backdrop", () => {
    expect(MANNEQUIN_NEGATIVE_PROMPT).not.toMatch(/seamless/);
    const built = buildPrompt({
      mode: "mannequin",
      backgroundPrompt: "Clean professional catalogue photo studio",
    });
    expect(built.prompt).toMatch(/Clean professional catalogue photo studio/);
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
