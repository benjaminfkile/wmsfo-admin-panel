// Page slug and title rules (admin.md 7.2). Mirrors the API.

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const RESERVED_SLUGS: readonly string[] = [
  "auth",
  "preview",
  "api",
  "admin",
  "assets",
];

export type PageInput = {
  slug: string;
  title: string;
  navLabel: string;
};

export type PageErrors = Partial<Record<keyof PageInput, string>>;

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function validatePage(input: PageInput): PageErrors {
  const errors: PageErrors = {};
  const slug = input.slug.trim();
  const title = input.title.trim();
  const navLabel = input.navLabel.trim();

  if (slug.length === 0 || slug.length > 60) {
    errors.slug = "Lowercase letters, digits, and single hyphens";
  } else if (!SLUG_PATTERN.test(slug)) {
    errors.slug = "Lowercase letters, digits, and single hyphens";
  } else if (RESERVED_SLUGS.includes(slug)) {
    errors.slug = "This name is reserved";
  }

  if (title.length === 0) {
    errors.title = "Title is required";
  } else if (title.length > 200) {
    errors.title = "Title must be 200 characters or fewer";
  }

  if (navLabel.length > 40) {
    errors.navLabel = "Nav label must be 40 characters or fewer";
  }
  return errors;
}
