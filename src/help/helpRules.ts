// The limits the API applies to a help topic (contracts 4.5 Help), and
// the soft limit past which the editor asks for a shorter text.
export const TITLE_MAX = 120;
export const BODY_SOFT_MAX = 600;
export const BODY_MAX = 2000;
export const LINKS_MAX = 6;
export const LINK_LABEL_MAX = 60;

export const DASHES = /[\u2013\u2014]/;

// A link goes to a panel path (one leading `/`) or an https:// URL.
export function isValidDestination(to: string): boolean {
  if (/^\/(?!\/)/.test(to)) return true;
  return /^https:\/\/\S+$/.test(to);
}

export const UNWRITTEN_TEXT = "No help written yet.";
