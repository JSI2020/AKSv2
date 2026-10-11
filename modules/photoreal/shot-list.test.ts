import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { STUDIO_BACKGROUND_PRESETS } from "@/modules/designs/studio-backgrounds";

import { COMMERCIAL_POSES } from "./commercial-poses";
import { FALLBACK_ADVICE } from "./shoot-advice";
import {
  AS_PHOTOGRAPHED,
  CLOSER_POSES,
  poseForShot,
  posePreviewSrc,
  SHOT_PRESETS,
  VARIATION_POSES,
} from "./shot-list";

const poseIds = new Set(COMMERCIAL_POSES.map((p) => p.id));
const locationIds = new Set<string>(STUDIO_BACKGROUND_PRESETS.map((p) => p.id));

describe("shot list", () => {
  it("only references poses that exist", () => {
    for (const preset of SHOT_PRESETS) {
      for (const id of preset.shots) expect(poseIds.has(id)).toBe(true);
    }
    for (const id of [...VARIATION_POSES, ...CLOSER_POSES, ...FALLBACK_ADVICE.shots]) {
      expect(poseIds.has(id)).toBe(true);
    }
    for (const id of FALLBACK_ADVICE.locations) expect(locationIds.has(id)).toBe(true);
  });

  it("copies the source framing for a mannequin front", () => {
    expect(poseForShot(AS_PHOTOGRAPHED, "person")).toBeNull();
    expect(poseForShot("front-straight", "mannequin")).toBeNull();
    expect(poseForShot("front-straight", "person")).toBe("front-straight");
    expect(poseForShot("portrait-half", "mannequin")).toBe("portrait-half");
  });

  it("has a preview photo for every pose and location", () => {
    for (const p of COMMERCIAL_POSES) {
      expect(existsSync(path.join("public", posePreviewSrc(p.id)))).toBe(true);
    }
    for (const id of locationIds) {
      expect(existsSync(path.join("public", "studio-locations", `${id}.webp`))).toBe(true);
    }
  });
});
