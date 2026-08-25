import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GarmentType, LengthBand } from "../db/enums";
import type { StylePoints } from "../core/style-points";
import { ghostMannequinPrompt } from "../core/ghost-prompt";
import { falKey, renderFalEdit } from "../providers/fal";

function absolute(publicUrl: string) {
  return path.join(process.cwd(), "public", publicUrl.replace(/^\//, ""));
}

export async function renderGhostMannequin(
  garmentPublicPath: string,
  spec: { garmentType: GarmentType; lengthBand: LengthBand; points?: StylePoints },
): Promise<string | null> {
  if (!falKey() || !garmentPublicPath.startsWith("/uploads/dress-sizing/")) return null;
  const input = absolute(garmentPublicPath);
  const bytes = await readFile(input);
  const file = new File([new Uint8Array(bytes)], path.basename(input), { type: "image/jpeg" });
  const imageUrl = await renderFalEdit(file, ghostMannequinPrompt(spec));
  if (!imageUrl) return null;
  const response = await fetch(imageUrl);
  if (!response.ok) return null;
  const output = garmentPublicPath.replace(/\.[^.]+$/, "-ghost.png");
  await writeFile(absolute(output), Buffer.from(await response.arrayBuffer()));
  return output;
}
