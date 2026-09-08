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
};

export type SponsorYearErrors = Partial<
  Record<"eventYear" | "amountDonated", string>
>;

const AMOUNT_RE = /^\d{1,10}(\.\d{1,2})?$/;
const AMOUNT_MAX = 1_000_000_000;

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
  return errors;
}

export function toSponsorYearBody(input: SponsorYearInput): {
  amountDonated: number | null;
  active: boolean;
  canAdvertise: boolean;
  anonymous: boolean;
} {
  const raw = input.amountDonated.trim();
  return {
    amountDonated: raw === "" ? null : Number(raw),
    active: input.active,
    canAdvertise: input.canAdvertise,
    anonymous: input.anonymous,
  };
}
