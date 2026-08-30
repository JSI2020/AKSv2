/**
 * Planar metrology — recover real-world inches from photo pixels.
 *
 * The mathematical core of "accurate size from a photo": a single image has no
 * absolute scale and is perspective-distorted. Both problems are solved at once
 * when four image points of a known real-world rectangle (an A4 sheet, a
 * printed calibration card) are visible: the 4-point homography maps the image
 * plane onto the card's plane, after which every coordinate IS in inches and
 * perspective is gone. Pure math, no I/O.
 */

export type Point = { x: number; y: number };

/** Row-major 3×3 homography. */
export type Homography = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
];

/** Solve A·x = b (n×n) via Gaussian elimination with partial pivoting. */
function solveLinear(a: number[][], b: number[]): number[] {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r]![col]!) > Math.abs(a[pivot]![col]!)) pivot = r;
    }
    if (Math.abs(a[pivot]![col]!) < 1e-12) {
      throw new Error("Degenerate calibration points (collinear or repeated)");
    }
    if (pivot !== col) {
      [a[col], a[pivot]] = [a[pivot]!, a[col]!];
      [b[col], b[pivot]] = [b[pivot]!, b[col]!];
    }
    for (let r = col + 1; r < n; r++) {
      const f = a[r]![col]! / a[col]![col]!;
      for (let c = col; c < n; c++) a[r]![c]! -= f * a[col]![c]!;
      b[r]! -= f * b[col]!;
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let sum = b[r]!;
    for (let c = r + 1; c < n; c++) sum -= a[r]![c]! * x[c]!;
    x[r] = sum / a[r]![r]!;
  }
  return x;
}

/**
 * Direct linear transform from 4 point correspondences (src → dst).
 * 8 unknowns (h22 = 1), 2 equations per pair.
 */
export function homographyFromPoints(
  src: readonly [Point, Point, Point, Point],
  dst: readonly [Point, Point, Point, Point],
): Homography {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]!;
    const { x: u, y: v } = dst[i]!;
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solveLinear(a, b);
  return [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!, 1];
}

export function applyHomography(h: Homography, p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}

/**
 * Build a rectifier from the four image corners of a known rectangle
 * (top-left, top-right, bottom-right, bottom-left) and its real size in
 * inches. Returned mapper converts any image point into inch coordinates on
 * the rectangle's plane; distances between mapped points are real inches for
 * everything lying (approximately) in that plane — i.e. a flat-laid garment
 * on the same table as the card.
 */
export function rectifierFromCard(
  corners: readonly [Point, Point, Point, Point],
  cardWidthIn: number,
  cardHeightIn: number,
): (p: Point) => Point {
  const h = homographyFromPoints(corners, [
    { x: 0, y: 0 },
    { x: cardWidthIn, y: 0 },
    { x: cardWidthIn, y: cardHeightIn },
    { x: 0, y: cardHeightIn },
  ]);
  return (p) => applyHomography(h, p);
}

export function distanceIn(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
