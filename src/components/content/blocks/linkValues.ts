import type { Icon } from "../../../api/types";
import type { LinkValue } from "./LinkControl";

export const EMPTY_LINK: LinkValue = {
  label: "",
  href: "",
  icon: null,
  newTab: false,
};

// Reads an unknown value as a list of links; missing parts take the
// empty link's values.
export function toLinks(items: unknown): LinkValue[] {
  if (!Array.isArray(items)) return [];
  return items.map((it) => {
    if (it && typeof it === "object") {
      const o = it as Record<string, unknown>;
      return {
        label: typeof o.label === "string" ? o.label : "",
        href: typeof o.href === "string" ? o.href : "",
        icon: o.icon && typeof o.icon === "object" ? (o.icon as Icon) : null,
        newTab: Boolean(o.newTab),
      };
    }
    return { ...EMPTY_LINK };
  });
}

// "Up to 2 links", "1 to 20 links" when at least one is required, or
// "At least 1 link" with no maximum; null with neither bound.
export function linkBoundsHint(min: number, max: number): string | null {
  const noun = (n: number) => (n === 1 ? "link" : "links");
  if (Number.isFinite(max)) {
    return min > 0
      ? `${min} to ${max} ${noun(max)}`
      : `Up to ${max} ${noun(max)}`;
  }
  return min > 0 ? `At least ${min} ${noun(min)}` : null;
}
