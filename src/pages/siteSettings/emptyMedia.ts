// A media reference whose switch is on but whose asset was never picked
// carries an empty mediaId; the API rejects that on the id's pattern with
// an error nobody can read. Saving treats it as "no media": the reference
// becomes null and the rest of the document is unchanged.
export function withoutEmptyMediaRefs(
  data: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const [key, value] of Object.entries(out)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "mediaId" in value &&
      (value as { mediaId?: unknown }).mediaId === ""
    ) {
      out[key] = null;
    }
  }
  return out;
}
