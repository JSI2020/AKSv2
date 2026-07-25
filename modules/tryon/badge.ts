import sharp from "sharp";

const BADGE_TEXT = "AI visualization";

/** Burn in AI-visualization badge on personalised render. */
export async function burnInAiBadge(body: Buffer): Promise<Buffer> {
  const image = sharp(body);
  const meta = await image.metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;

  const fontSize = Math.max(12, Math.round(width * 0.022));
  const padX = Math.round(fontSize * 0.6);
  const padY = Math.round(fontSize * 0.35);
  const badgeWidth = BADGE_TEXT.length * fontSize * 0.55 + padX * 2;
  const badgeHeight = fontSize + padY * 2;

  const svg = `
    <svg width="${width}" height="${height}">
      <rect x="${width - badgeWidth - 12}" y="${height - badgeHeight - 12}"
        width="${badgeWidth}" height="${badgeHeight}" fill="#16181D" opacity="0.82"/>
      <text x="${width - badgeWidth - 12 + padX}" y="${height - badgeHeight - 12 + padY + fontSize * 0.85}"
        font-family="Arial, sans-serif" font-size="${fontSize}" fill="#DCD9CF">${BADGE_TEXT}</text>
    </svg>`;

  return image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
