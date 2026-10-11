import { describe, expect, it } from "vitest";

import { COMMERCIAL_POSES } from "./commercial-poses";
import {
  CLOSER_POSES,
  poseForShot,
  shotById,
  SHOTS,
  STANDARD_SET,
  VARIATION_POSES,
} from "./shot-list";

const poseIds = new Set(COMMERCIAL_POSES.map((p) => p.id));

describe("shot list", () => {
  it("only references poses that exist", () => {
    for (const shot of SHOTS) {
      expect(poseIds.has(shot.poseId)).toBe(true);
      if (shot.mannequinPoseId) expect(poseIds.has(shot.mannequinPoseId)).toBe(true);
    }
    for (const id of [...VARIATION_POSES, ...CLOSER_POSES]) {
      expect(poseIds.has(id)).toBe(true);
    }
  });

  it("copies the source framing for a mannequin front shot", () => {
    const front = shotById("front");
    expect(poseForShot(front, "mannequin")).toBeNull();
    expect(poseForShot(front, "person")).toBe("front-straight");
  });

  it("has a four-frame standard set", () => {
    expect(STANDARD_SET).toEqual(["front", "three-quarter", "portrait", "back"]);
  });
});
