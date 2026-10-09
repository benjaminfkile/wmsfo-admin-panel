// Bounding box rules (admin.md 7.2, `trackerBbox` and
// `tracker.defaultBbox`): west under east, south under north, each side
// 0.05 to 20 degrees, longitudes -180 to 180, latitudes -90 to 90.

export type Bbox = { west: number; south: number; east: number; north: number };

export type BboxSide = keyof Bbox;

export type BboxErrors = Partial<Record<BboxSide, string>>;

export const BBOX_SIDES: readonly BboxSide[] = ["west", "south", "east", "north"];

export const MIN_SIDE_DEG = 0.05;
export const MAX_SIDE_DEG = 20;

export const SIDE_MESSAGE = "Each side must be between 0.05 and 20 degrees";

const LABELS: Record<BboxSide, string> = {
  west: "West",
  south: "South",
  east: "East",
  north: "North",
};

function rangeError(side: BboxSide, v: number): string | null {
  if (!Number.isFinite(v)) return "Enter a number";
  const limit = side === "west" || side === "east" ? 180 : 90;
  if (v < -limit || v > limit) return `${LABELS[side]} must be between -${limit} and ${limit}`;
  return null;
}

// The field errors of a box: each coordinate's range first, then the
// order of each pair (on west and south), then each side's size (on east
// and north).
export function validateBbox(b: Bbox): BboxErrors {
  const errors: BboxErrors = {};
  for (const side of BBOX_SIDES) {
    const e = rangeError(side, b[side]);
    if (e) errors[side] = e;
  }
  if (!errors.west && !errors.east) {
    if (b.west >= b.east) errors.west = "West must be less than east";
    else if (!sideOk(b.east - b.west)) errors.east = SIDE_MESSAGE;
  }
  if (!errors.south && !errors.north) {
    if (b.south >= b.north) errors.south = "South must be less than north";
    else if (!sideOk(b.north - b.south)) errors.north = SIDE_MESSAGE;
  }
  return errors;
}

function sideOk(deg: number): boolean {
  // Rounded to the four decimals the fields show, so 0.05 typed is 0.05.
  const d = Math.round(deg * 1e4) / 1e4;
  return d >= MIN_SIDE_DEG && d <= MAX_SIDE_DEG;
}

export function bboxValid(b: Bbox): boolean {
  return Object.keys(validateBbox(b)).length === 0;
}
