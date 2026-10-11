import { describe, expect, it } from "vitest";

import {
  groupedStudioBackgrounds,
  resolveStudioBackgroundPrompt,
  STUDIO_BACKGROUND_PRESETS,
} from "@/modules/designs/studio-backgrounds";

import { COMMERCIAL_POSES } from "./commercial-poses";

import {
  buildPrompt,
  INPUT_SOURCE_TABS,
  MANNEQUIN_NEGATIVE_PROMPT,
  promptModeFromSavedPrompt,
  resolvePromptMode,
  type PromptMode,
} from "./prompt-builder";

describe("mannequin mode", () => {
  it("lives in Photograph a dress, not in Create a look", () => {
    expect(INPUT_SOURCE_TABS.map((t) => t.id)).toEqual([
      "sketch",
      "old-design",
      "description",
    ]);
  });

  it("covers hangers and flat-lays as well as mannequins", () => {
    const { prompt } = buildPrompt({ mode: "mannequin" });
    expect(prompt).toMatch(/on a HANGER, or laid FLAT/);
    expect(prompt).toMatch(/hanger, pins, clips, flat-lay surface/);
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
    expect(built.negativePrompt).toMatch(/creased fabric/);
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

describe("campaign quality across modes", () => {
  it("presses the garment in every photo-based mode", () => {
    for (const mode of ["repose", "mannequin", "old-design"] as const) {
      expect(buildPrompt({ mode }).prompt).toMatch(/GARMENT PRESSING \(mandatory\)/);
    }
    expect(buildPrompt({ mode: "sketch" }).prompt).not.toMatch(/GARMENT PRESSING/);
  });

  it("asks for a real smile and brand-level styling", () => {
    const { prompt, negativePrompt } = buildPrompt({ mode: "repose" });
    expect(prompt).toMatch(/genuine, confident smile/);
    expect(prompt).toMatch(/Styling: polished natural make-up/);
    expect(prompt).toMatch(/Luxury modest fashion campaign/);
    expect(negativePrompt).toMatch(/wrinkled fabric/);
  });

  it("offers the photo-set and portrait poses", () => {
    for (const id of [
      "front-straight",
      "three-quarter-stand",
      "portrait-half",
      "back-three-quarter",
      "portrait-smile",
      "portrait-laugh",
    ]) {
      expect(COMMERCIAL_POSES.some((p) => p.id === id)).toBe(true);
    }
    const ids = COMMERCIAL_POSES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("multiple garment photos", () => {
  it("reads several photos together as one source of truth", () => {
    const { prompt } = buildPrompt({ mode: "repose", garmentReferenceCount: 4 });
    expect(prompt).toMatch(/GARMENT REFERENCES: 4 reference photos of the SAME garment/);
    expect(prompt).toMatch(/follow the close-up/);
    expect(prompt).not.toMatch(/EDIT REFERENCES/);
  });

  it("does not add the multi-photo line for a single photo", () => {
    const { prompt } = buildPrompt({ mode: "repose", garmentReferenceCount: 1 });
    expect(prompt).not.toMatch(/GARMENT REFERENCES/);
  });

  it("re-reads the original photos on every refine", () => {
    const single = buildPrompt({
      mode: "repose",
      refine: true,
      keepPose: true,
      garmentReferenceCount: 1,
    }).prompt;
    expect(single).toMatch(/EDIT REFERENCES: the FIRST attached image is the previous photograph/);
    expect(single).toMatch(/The second image is the ORIGINAL garment reference photo:/);

    const many = buildPrompt({
      mode: "mannequin",
      refine: true,
      poseId: "portrait-smile",
      garmentReferenceCount: 5,
    }).prompt;
    expect(many).toMatch(/The remaining 5 images are the ORIGINAL garment reference photos/);
    expect(many).toMatch(/A pose or background change never changes the garment/);
    expect(many).toMatch(/GARMENT REFERENCES: 5/);
  });

  it("phrases a picked pose on refine as a re-shoot, not a near-copy", () => {
    const refine = buildPrompt({ mode: "repose", refine: true, poseId: "portrait-half" }).prompt;
    expect(refine).toMatch(/POSE \/ FRAMING CHANGE — re-photograph/);
    expect(refine).toMatch(/waist-up half-body portrait/);
    const generate = buildPrompt({ mode: "repose", poseId: "portrait-half" }).prompt;
    expect(generate).not.toMatch(/POSE \/ FRAMING CHANGE/);
  });

  it("ignores reference counts in modes that may restyle", () => {
    const { prompt } = buildPrompt({
      mode: "old-design",
      refine: true,
      garmentReferenceCount: 3,
    });
    expect(prompt).not.toMatch(/EDIT REFERENCES|GARMENT REFERENCES/);
  });
});

describe("background library", () => {
  it("has unique ids, every group populated, and a courtyard fallback", () => {
    const ids = STUDIO_BACKGROUND_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { presets } of groupedStudioBackgrounds()) {
      expect(presets.length).toBeGreaterThan(0);
    }
    expect(resolveStudioBackgroundPrompt({ presetId: "nope" })).toMatch(
      /courtyard/,
    );
    expect(
      resolveStudioBackgroundPrompt({ presetId: "studio", custom: "my rooftop" }),
    ).toBe("my rooftop");
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
