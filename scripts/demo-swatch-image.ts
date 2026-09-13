import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

import sharp from "sharp";

export type SwatchTexture = "knit" | "weave" | "silk" | "velvet" | "sheer";

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function shadeHex(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const mix = (channel: number) =>
    Math.round(Math.min(255, Math.max(0, channel * factor)));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

function textureOverlay(texture: SwatchTexture): string {
  switch (texture) {
    case "knit":
      return `<pattern id="weave" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(18)">
        <line x1="0" y1="0" x2="0" y2="5" stroke="rgba(0,0,0,0.07)" stroke-width="0.7"/>
        <line x1="2.5" y1="0" x2="2.5" y2="5" stroke="rgba(255,255,255,0.08)" stroke-width="0.7"/>
      </pattern>`;
    case "silk":
      return `<pattern id="weave" width="12" height="12" patternUnits="userSpaceOnUse">
        <path d="M0 12 L12 0" stroke="rgba(255,255,255,0.1)" stroke-width="0.6"/>
        <path d="M-4 4 L4 -4 M8 16 L16 8" stroke="rgba(0,0,0,0.05)" stroke-width="0.5"/>
      </pattern>`;
    case "velvet":
      return `<pattern id="weave" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="rgba(0,0,0,0.05)"/>
        <circle cx="4" cy="4" r="1.2" fill="rgba(255,255,255,0.07)"/>
      </pattern>`;
    case "sheer":
      return `<pattern id="weave" width="6" height="6" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="0.5" fill="rgba(255,255,255,0.14)"/>
        <circle cx="4.5" cy="4.5" r="0.5" fill="rgba(0,0,0,0.06)"/>
      </pattern>`;
    default:
      return `<pattern id="weave" width="9" height="9" patternUnits="userSpaceOnUse">
        <path d="M0 9 L9 0" stroke="rgba(0,0,0,0.05)" stroke-width="0.7"/>
        <path d="M-2 2 L2 -2 M7 11 L11 7" stroke="rgba(255,255,255,0.07)" stroke-width="0.6"/>
      </pattern>`;
  }
}

/** One ribbon along an Archimedean spiral (overhead catalogue coil). */
function spiralRibbonPath(
  cx: number,
  cy: number,
  a: number,
  b: number,
  theta0: number,
  theta1: number,
  halfWidth: number,
): string {
  const steps = 28;
  const outer: Array<{ x: number; y: number }> = [];
  const inner: Array<{ x: number; y: number }> = [];

  for (let i = 0; i <= steps; i++) {
    const theta = theta0 + ((theta1 - theta0) * i) / steps;
    const r = a + b * theta;
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta);
    const nx = Math.cos(theta);
    const ny = Math.sin(theta);
    outer.push({ x: x + nx * halfWidth, y: y + ny * halfWidth });
    inner.unshift({ x: x - nx * halfWidth, y: y - ny * halfWidth });
  }

  const ring = [...outer, ...inner];
  return (
    ring
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ") + " Z"
  );
}

/** Archimedean spiral strips — reads as coiled cloth, not a flat target. */
function spiralDrapeBands(hex: string): string {
  const base = escapeXml(hex);
  const light = escapeXml(shadeHex(hex, 1.12));
  const mid = escapeXml(shadeHex(hex, 0.94));
  const dark = escapeXml(shadeHex(hex, 0.78));
  const cx = 256;
  const cy = 256;
  const a = 6;
  const b = 11.5;
  const halfWidth = 13;
  const maxR = 238;

  const fills = [base, mid, dark, light, base, mid, dark];
  const paths: string[] = [];
  let theta = 0.35;
  let band = 0;

  while (a + b * theta < maxR) {
    const rNow = a + b * theta;
    const delta =
      halfWidth / Math.max(rNow * 0.085, 1.4);
    const theta1 = theta + delta;
    const d = spiralRibbonPath(cx, cy, a, b, theta, theta1, halfWidth);
    const fill = fills[band % fills.length]!;
    const shadow = band % 2 === 0 ? 0.97 : 0.88;
    paths.push(
      `<path d="${d}" fill="${fill}" fill-opacity="${shadow}" stroke="rgba(0,0,0,0.09)" stroke-width="0.45"/>`,
    );
    theta = theta1;
    band += 1;
  }

  // Loose tail — outer end of the coil
  paths.push(
    `<path d="M ${cx + (a + b * theta) * Math.cos(theta - 0.2)} ${cy + (a + b * theta) * Math.sin(theta - 0.2)} Q ${cx + maxR * 0.92} ${cy - 18} ${cx + maxR * 0.55} ${cy + maxR * 0.42}" fill="none" stroke="${dark}" stroke-opacity="0.35" stroke-width="3"/>`,
  );

  return paths.join("\n    ");
}

export async function renderDemoSwatchJpeg(input: {
  hex: string;
  texture: SwatchTexture;
}): Promise<Buffer> {
  const defs = textureOverlay(input.texture);
  const spiral = spiralDrapeBands(input.hex);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>${defs}</defs>
    <rect width="512" height="512" fill="#E8E4DC"/>
    ${spiral}
    <rect width="512" height="512" fill="url(#weave)" opacity="0.42"/>
    <radialGradient id="vignette" cx="50%" cy="46%" r="62%">
      <stop offset="50%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.16)"/>
    </radialGradient>
    <rect width="512" height="512" fill="url(#vignette)"/>
  </svg>`;

  return sharp(Buffer.from(svg)).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
}

export async function ensureDemoSwatchFile(input: {
  file: string;
  hex: string;
  texture: SwatchTexture;
  rootDir?: string;
  force?: boolean;
}): Promise<string> {
  const root = input.rootDir ?? process.cwd();
  const localPath = join(root, "public/fabrics/demo", input.file);
  if (!input.force && existsSync(localPath)) {
    return localPath;
  }
  mkdirSync(dirname(localPath), { recursive: true });
  const jpeg = await renderDemoSwatchJpeg({
    hex: input.hex,
    texture: input.texture,
  });
  writeFileSync(localPath, jpeg);
  return localPath;
}
