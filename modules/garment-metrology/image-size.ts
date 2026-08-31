/**
 * Intrinsic image dimensions from header bytes — JPEG, PNG, WebP.
 *
 * The metrology needs the true aspect ratio: normalized landmarks are scaled
 * by width and height separately, so guessing a square image would skew every
 * horizontal span against every vertical one. Pure byte parsing, no deps.
 */

export type ImageSize = { width: number; height: number };

function readPng(b: Uint8Array): ImageSize | null {
  if (b.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!sig.every((v, i) => b[i] === v)) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function readJpeg(b: Uint8Array): ImageSize | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1]!;
    // Standalone markers carry no payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const length = view.getUint16(i + 2);
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 && // DHT
      marker !== 0xc8 && // JPG extension
      marker !== 0xcc; // DAC
    if (isSof) {
      return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
    }
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
}

function readWebp(b: Uint8Array): ImageSize | null {
  if (b.length < 30) return null;
  const tag = (o: number) => String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
  if (tag(0) !== "RIFF" || tag(8) !== "WEBP") return null;
  const format = tag(12);
  const u16 = (o: number) => b[o]! | (b[o + 1]! << 8);
  const u24 = (o: number) => b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16);

  if (format === "VP8 ") {
    // Frame tag (3) + start code 9d 01 2a (3), then 14-bit dims.
    return { width: u16(26) & 0x3fff, height: u16(28) & 0x3fff };
  }
  if (format === "VP8L") {
    const bits = u24(21) | (b[24]! << 24);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }
  if (format === "VP8X") {
    return { width: u24(24) + 1, height: u24(27) + 1 };
  }
  return null;
}

/** Returns null when the format is unrecognised or the header is truncated. */
export function imageSizeFromBytes(bytes: Uint8Array): ImageSize | null {
  const size = readPng(bytes) ?? readJpeg(bytes) ?? readWebp(bytes);
  if (!size || size.width <= 0 || size.height <= 0) return null;
  return size;
}

export async function imageSizeFromFile(file: {
  arrayBuffer(): Promise<ArrayBuffer>;
}): Promise<ImageSize | null> {
  try {
    return imageSizeFromBytes(new Uint8Array(await file.arrayBuffer()));
  } catch {
    return null;
  }
}

/**
 * Dimensions of a hosted image. Only the header is needed, so this asks for the
 * first 64KB and falls back to a full read when the host ignores Range.
 */
export async function imageSizeFromUrl(
  url: string,
): Promise<ImageSize | null> {
  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-65535" } });
    if (!res.ok && res.status !== 206) return null;
    return imageSizeFromBytes(new Uint8Array(await res.arrayBuffer()));
  } catch {
    return null;
  }
}
