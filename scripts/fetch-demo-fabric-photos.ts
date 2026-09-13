import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import sharp from "sharp";

import { LAUNCH_FABRIC_CATALOG } from "./demo-fabric-catalog-data";
import {
  DEMO_FABRIC_PHOTO_SOURCES,
  pexelsDownloadUrl,
} from "./demo-fabric-photo-sources";

const OUT_SIZE = 512;

async function downloadAndSave(file: string, pexelsId: number): Promise<void> {
  const url = pexelsDownloadUrl(pexelsId, 1200);
  const res = await fetch(url, {
    headers: { "User-Agent": "AKS-demo-seed/1.0" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${file} (pexels ${pexelsId})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const jpeg = await sharp(buf)
    .resize(OUT_SIZE, OUT_SIZE, { fit: "cover", position: "centre" })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();

  const localPath = join(process.cwd(), "public/fabrics/demo", file);
  mkdirSync(dirname(localPath), { recursive: true });
  writeFileSync(localPath, jpeg);
}

/** Download real fabric drape photos from Pexels into public/fabrics/demo/. */
async function main() {
  console.log(`\nDownloading ${LAUNCH_FABRIC_CATALOG.length} fabric photos from Pexels…\n`);

  for (const def of LAUNCH_FABRIC_CATALOG) {
    const source = DEMO_FABRIC_PHOTO_SOURCES[def.file];
    if (!source) {
      console.log(`  SKIP  ${def.file} — no Pexels mapping`);
      continue;
    }
    await downloadAndSave(def.file, source.pexelsId);
    console.log(
      `  ${def.name} ← pexels/${source.pexelsId} (${source.credit})`,
    );
  }

  console.log("\nDone. Run npm run db:refresh:fabrics to push to database.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
