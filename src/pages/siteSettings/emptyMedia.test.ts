import { describe, expect, it } from "vitest";
import { withoutEmptyMediaRefs } from "./emptyMedia";

describe("withoutEmptyMediaRefs", () => {
  it("turns a media reference with no picked asset into null", () => {
    expect(
      withoutEmptyMediaRefs({ siteName: "x", logoMedia: { mediaId: "", alt: null } })
    ).toEqual({ siteName: "x", logoMedia: null });
  });

  it("keeps a picked media reference and every other value", () => {
    const data = {
      siteName: "x",
      logoMedia: { mediaId: "8028d1ca-391a-4dcd-ac08-e2fe05a5d44a", alt: "Logo" },
      headerLinks: [{ label: "Facebook", href: "https://example.com", icon: null, newTab: true }],
      theme: { snowDefault: true },
    };
    expect(withoutEmptyMediaRefs(data)).toEqual(data);
  });

  it("leaves null and absent references alone", () => {
    expect(withoutEmptyMediaRefs({ logoMedia: null })).toEqual({ logoMedia: null });
    expect(withoutEmptyMediaRefs({ siteName: "x" })).toEqual({ siteName: "x" });
  });
});
