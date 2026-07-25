import sharp from "sharp";

/** Branded share card sized for WhatsApp (1080×1080). */
export async function buildShareCard(input: {
  resultImage: Buffer;
  designName: string;
}): Promise<Buffer> {
  const size = 1080;
  const renderSize = 900;

  const fitted = await sharp(input.resultImage)
    .resize(renderSize, renderSize, { fit: "cover" })
    .toBuffer();

  const headerSvg = `
    <svg width="${size}" height="180">
      <rect width="${size}" height="180" fill="#1B2547"/>
      <text x="540" y="72" text-anchor="middle" font-family="Georgia, serif" font-size="42" fill="#DCD9CF">AKS</text>
      <text x="540" y="118" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#8FA6B2">a reflection</text>
    </svg>`;

  const footerSvg = `
    <svg width="${size}" height="120">
      <rect width="${size}" height="120" fill="#DCD9CF"/>
      <text x="540" y="52" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#16181D">${escapeXml(input.designName.slice(0, 48))}</text>
      <text x="540" y="88" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#8C2F39">AI visualization — not a photograph</text>
    </svg>`;

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 220, g: 217, b: 207 },
    },
  })
    .composite([
      { input: Buffer.from(headerSvg), top: 0, left: 0 },
      { input: fitted, top: 180, left: Math.round((size - renderSize) / 2) },
      { input: Buffer.from(footerSvg), top: size - 120, left: 0 },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
