/**
 * One-time generator for AI Studio picker previews:
 *   public/studio-locations/<id>.webp — each location, empty, as a real photo
 *   public/studio-poses/<id>.webp     — a model in a plain outfit in each pose
 *
 * Idempotent: existing files are skipped, so re-running only fills gaps.
 * Usage: npx tsx scripts/generate-studio-previews.ts [--only=locations|poses]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { fal } from "@fal-ai/client";
import { config } from "dotenv";
import sharp from "sharp";

import { STUDIO_BACKGROUND_PRESETS } from "../modules/designs/studio-backgrounds";
import { COMMERCIAL_POSES } from "../modules/photoreal/commercial-poses";

config({ path: ".env.local" });

const MODEL = "fal-ai/flux/dev";
const CONCURRENCY = 4;

type Job = {
  file: string;
  prompt: string;
  size: "landscape_4_3" | "portrait_4_3";
  width: number;
  height: number;
};

function locationJobs(): Job[] {
  const dir = path.join("public", "studio-locations");
  mkdirSync(dir, { recursive: true });
  return STUDIO_BACKGROUND_PRESETS.map((p) => ({
    file: path.join(dir, `${p.id}.webp`),
    prompt: `${p.prompt} Empty scene with no people, no text, no logos. Unretouched editorial location photograph taken on a full-frame camera with a 35mm lens at eye level: natural muted true-to-life colours, soft natural light, no HDR, no oversaturation, no sun flare or glowing haze, slight natural film grain, documentary realism.`,
    size: "landscape_4_3" as const,
    width: 480,
    height: 360,
  }));
}

function poseJobs(): Job[] {
  const dir = path.join("public", "studio-poses");
  mkdirSync(dir, { recursive: true });
  return COMMERCIAL_POSES.map((p) => {
    const direction = p.prompt.replace(/^(Pose|Framing):\s*/i, "");
    // A visible mirror reads as a second model in a small thumbnail.
    const single = /mirror/i.test(p.prompt)
      ? " Exactly one person in frame; the mirror itself is out of frame, no reflection visible."
      : " Exactly one person in frame.";
    if (p.category === "Detail") {
      return {
        file: path.join(dir, `${p.id}.webp`),
        prompt: `Luxury macro detail photograph of an ivory kameez with tone-on-tone ivory thread embroidery: ${direction} Modest high round neckline. The frame is filled with the garment detail; no face visible. Soft natural studio light, crisp thread texture. Photorealistic, real camera, no text.`,
        size: "portrait_4_3" as const,
        width: 300,
        height: 400,
      };
    }
    return {
      file: path.join(dir, `${p.id}.webp`),
      prompt: `Professional fashion catalogue photograph of a South Asian woman model wearing a plain ivory long kameez with straight ivory trousers, no dupatta, hair in a sleek low bun. ${direction}${single} Seamless warm light-grey studio backdrop, soft even light. Photorealistic, real camera, no text.`,
      size: "portrait_4_3" as const,
      width: 300,
      height: 400,
    };
  });
}

async function render(job: Job): Promise<void> {
  const result = await fal.subscribe(MODEL, {
    input: {
      prompt: job.prompt,
      image_size: job.size,
      num_images: 1,
      output_format: "jpeg",
      enable_safety_checker: true,
    },
    logs: false,
  });
  const data = result.data as { images?: Array<{ url?: string }> };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error("no image returned");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const webp = await sharp(Buffer.from(await res.arrayBuffer()))
    .resize(job.width, job.height, { fit: "cover", position: "attention" })
    .webp({ quality: 78 })
    .toBuffer();
  writeFileSync(job.file, webp);
}

async function main() {
  const key = process.env.FAL_KEY?.trim();
  if (!key) throw new Error("FAL_KEY is not set (.env.local)");
  fal.config({ credentials: key });

  const only = process.argv.find((a) => a.startsWith("--only="))?.split("=")[1];
  const jobs = [
    ...(only === "poses" ? [] : locationJobs()),
    ...(only === "locations" ? [] : poseJobs()),
  ].filter((j) => !existsSync(j.file));

  console.log(`${jobs.length} previews to generate`);
  let done = 0;
  let failed = 0;
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        try {
          await render(job);
          done++;
        } catch (err) {
          failed++;
          console.error(`✗ ${job.file}: ${err instanceof Error ? err.message : err}`);
        }
        if ((done + failed) % 10 === 0) console.log(`  ${done + failed}/${jobs.length}`);
      }
    }),
  );
  console.log(`done ${done}, failed ${failed}`);
  if (failed) process.exitCode = 1;
}

void main();
