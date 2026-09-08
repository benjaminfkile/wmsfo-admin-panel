import { describe, it, expect } from "vitest";
import {
  RESERVED_SLUGS,
  slugify,
  validatePage,
} from "./page";

describe("validatePage", () => {
  const base = { slug: "about", title: "About", navLabel: "" };

  it("accepts a well-formed slug and title", () => {
    expect(validatePage(base)).toEqual({});
  });

  it("rejects empty slug", () => {
    expect(validatePage({ ...base, slug: "" })).toHaveProperty("slug");
  });

  it("rejects a slug with underscores or uppercase", () => {
    expect(validatePage({ ...base, slug: "About_us" })).toHaveProperty("slug");
    expect(validatePage({ ...base, slug: "about--us" })).toHaveProperty("slug");
    expect(validatePage({ ...base, slug: "-about" })).toHaveProperty("slug");
  });

  it("rejects every reserved name", () => {
    for (const r of RESERVED_SLUGS) {
      const errs = validatePage({ ...base, slug: r });
      expect(errs.slug).toBe("This name is reserved");
    }
  });

  it("rejects an empty title", () => {
    expect(validatePage({ ...base, title: "" })).toHaveProperty("title");
  });

  it("rejects a title over 200 chars", () => {
    const t = "x".repeat(201);
    expect(validatePage({ ...base, title: t })).toHaveProperty("title");
  });

  it("rejects a navLabel over 40 chars", () => {
    expect(validatePage({ ...base, navLabel: "x".repeat(41) })).toHaveProperty(
      "navLabel"
    );
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("About Us")).toBe("about-us");
    expect(slugify("Hello, World!")).toBe("hello-world");
  });

  it("trims edge hyphens", () => {
    expect(slugify(" -- Home -- ")).toBe("home");
  });

  it("truncates to 60 chars", () => {
    const long = "x".repeat(200);
    expect(slugify(long)).toHaveLength(60);
  });
});
