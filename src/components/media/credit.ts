// The longest credit a media asset takes.
export const CREDIT_MAX = 200;

// The credit to send: the trimmed text cut to CREDIT_MAX, or null (no
// credit) when that is empty.
export function creditValue(text: string): string | null {
  const trimmed = text.trim().slice(0, CREDIT_MAX);
  return trimmed === "" ? null : trimmed;
}
