import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { Metadata } from "next";

import styles from "./coming-soon.module.css";

/*
 * Pre-launch holding page.
 *
 * Shown for every storefront URL while the launch gate is on (env var
 * COMING_SOON — see middleware.ts). Fully self-contained; turning the gate
 * off restores the real shop untouched.
 *
 * PHOTOS: drop portrait shots in /public/holding named g1, g2, g3, g4 (any
 * image extension — .jpg/.png/.webp all work). They fill the whole screen as
 * a full-bleed mood wall; only stems that have a file are shown, so one photo
 * reads as a single full-bleed hero and up to four as a full-height wall.
 */
const LOOKS = [
  {
    stem: "g1",
    alt: "Maroon embroidered top with printed wide-leg palazzo",
  },
  { stem: "g2", alt: "Teal embellished full-length evening dress" },
  { stem: "g3", alt: "Powder-blue embroidered kaftan" },
  { stem: "g4", alt: "Mint linen appliqué kurta and palazzo" },
] as const;

const HOLDING_DIR = join(process.cwd(), "public", "holding");

/** Find the actual filename for a stem (g2 → g2.png / g2.jpg / …). */
function resolvePhoto(stem: string): string | null {
  if (!existsSync(HOLDING_DIR)) return null;
  const match = readdirSync(HOLDING_DIR).find(
    (f) => f.replace(/\.[^.]+$/, "").toLowerCase() === stem,
  );
  return match ?? null;
}

export const metadata: Metadata = {
  title: "AKS — Arriving soon",
  description: "AKS Atelier. Ready-to-wear, arriving soon.",
  robots: { index: false, follow: false },
};

export default function ComingSoonPage() {
  const photos = LOOKS.map((look) => ({
    ...look,
    file: resolvePhoto(look.stem),
  })).filter(
    (p): p is (typeof LOOKS)[number] & { file: string } => p.file !== null,
  );

  return (
    <main className={styles.stage}>
      {photos.length > 0 ? (
        <div className={styles.canvas} aria-hidden={photos.length > 1}>
          {photos.map((p) => (
            <div className={styles.pane} key={p.stem}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.photo}
                src={`/holding/${p.file}`}
                alt={photos.length > 1 ? "" : p.alt}
              />
            </div>
          ))}
        </div>
      ) : null}

      <div className={styles.scrim} aria-hidden="true" />

      <section className={styles.veil}>
        <p className={styles.eyebrow}>AKS · Atelier</p>
        <h1 className={styles.headline}>
          Arriving <em>soon</em>.
        </h1>
        <p className={styles.sub}>
          Eastern silhouettes cut with Western restraint, in matte natural
          cloth. The house is preparing its first edition — we open the doors
          shortly.
        </p>
        <hr className={styles.rule} />
        <p className={styles.foot}>AKS Atelier · Pakistan</p>
      </section>
    </main>
  );
}
