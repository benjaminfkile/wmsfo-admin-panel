// Sponsor field validation (admin.md 7.2).

export type SponsorField =
  | "name"
  | "contactPerson"
  | "email"
  | "phone"
  | "address"
  | "websiteUrl"
  | "fbUrl"
  | "igUrl";

export type SponsorInput = Record<SponsorField, string>;

export type SponsorErrors = Partial<Record<SponsorField, string>>;

const URL_MAX = 2048;

function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateSponsor(input: SponsorInput): SponsorErrors {
  const errors: SponsorErrors = {};
  const name = input.name.trim();
  if (name.length < 1) errors.name = "Name is required";
  else if (name.length > 200) errors.name = "Name must be 200 characters or fewer";

  for (const key of ["websiteUrl", "fbUrl", "igUrl"] as SponsorField[]) {
    const raw = input[key].trim();
    if (raw.length > 0) {
      if (raw.length > URL_MAX || !isHttpUrl(raw)) {
        errors[key] = "Enter an absolute http or https URL";
      }
    }
  }
  return errors;
}

export function toSponsorBody(input: SponsorInput): Record<SponsorField, string | null> {
  const out = {} as Record<SponsorField, string | null>;
  (Object.keys(input) as SponsorField[]).forEach((k) => {
    const v = input[k].trim();
    out[k] = v === "" ? null : v;
  });
  return out;
}

// Sponsor year rules.

export type SponsorYearInput = {
  eventYear: string;
  amountDonated: string;
  active: boolean;
  canAdvertise: boolean;
  anonymous: boolean;
  lingerMsOverride: string;
  pinnedPosition: string;
};

export type SponsorYearErrors = Partial<
  Record<
    "eventYear" | "amountDonated" | "lingerMsOverride" | "pinnedPosition",
    string
  >
>;

const AMOUNT_RE = /^\d{1,10}(\.\d{1,2})?$/;
const AMOUNT_MAX = 1_000_000_000;
const LINGER_MAX_SECONDS = 600;
const PINNED_MIN = 1;
const PINNED_MAX = 1000;

export function validateSponsorYear(input: SponsorYearInput): SponsorYearErrors {
  const errors: SponsorYearErrors = {};
  const y = Number(input.eventYear);
  if (
    !Number.isFinite(y) ||
    !Number.isInteger(y) ||
    y < 2000 ||
    y > 2100
  ) {
    errors.eventYear = "Year must be between 2000 and 2100";
  }
  const raw = input.amountDonated.trim();
  if (raw.length > 0) {
    if (!AMOUNT_RE.test(raw) || Number(raw) > AMOUNT_MAX) {
      errors.amountDonated =
        "Amount with at most two decimals, up to 1,000,000,000";
    }
  }
  const linger = input.lingerMsOverride.trim();
  if (linger.length > 0) {
    const n = Number(linger);
    if (
      !Number.isFinite(n) ||
      !Number.isInteger(n) ||
      n < 0 ||
      n > LINGER_MAX_SECONDS
    ) {
      errors.lingerMsOverride =
        "Whole number of seconds between 0 and 600";
    }
  }
  const pinned = input.pinnedPosition.trim();
  if (pinned.length > 0) {
    const n = Number(pinned);
    if (
      !Number.isFinite(n) ||
      !Number.isInteger(n) ||
      n < PINNED_MIN ||
      n > PINNED_MAX
    ) {
      errors.pinnedPosition =
        "Whole number between 1 and 1000";
    }
  }
  return errors;
}

export function toSponsorYearBody(input: SponsorYearInput): {
  amountDonated: number | null;
  active: boolean;
  canAdvertise: boolean;
  anonymous: boolean;
  pinnedPosition: number | null;
  lingerMsOverride: number | null;
} {
  const raw = input.amountDonated.trim();
  const linger = input.lingerMsOverride.trim();
  const pinned = input.pinnedPosition.trim();
  return {
    amountDonated: raw === "" ? null : Number(raw),
    active: input.active,
    canAdvertise: input.canAdvertise,
    anonymous: input.anonymous,
    lingerMsOverride: linger === "" ? null : Number(linger) * 1000,
    pinnedPosition: pinned === "" ? null : Number(pinned),
  };
}

// Computed tracker time (linger ms) preview for the year dialog.
// Mirrors contracts.md `sponsors[].lingerMs` when there is no override.
export function computeLingerMs(opts: {
  amountDonated: number | null;
  msPerDollar: number;
  minMs: number;
}): number {
  const { amountDonated, msPerDollar, minMs } = opts;
  if (amountDonated === null) return minMs;
  return Math.max(minMs, Math.round(amountDonated * msPerDollar));
}
