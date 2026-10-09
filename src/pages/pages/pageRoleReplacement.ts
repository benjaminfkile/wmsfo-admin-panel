import type { Replacement } from "../../components/DeleteDialog";
import type { PageAdmin } from "../../api/types";
import { statusRoleLabel } from "./statusRoleLabel";

// The required "Page that takes the <role> role" select of admin.md 8.3:
// a page holding a role hands it to one of the content pages before it
// goes. A content page needs no replacement.
export function pageRoleReplacement(
  page: PageAdmin,
  pages: PageAdmin[]
): Replacement | null {
  const role = page.role ?? "none";
  if (role === "none") return null;
  return {
    label: `Page that takes the ${statusRoleLabel(role)} role`,
    candidates: pages
      .filter((p) => p.role === "none" && Number(p.id) !== Number(page.id))
      .map((p) => ({ id: Number(p.id), name: p.title ?? `#${String(p.id)}` })),
    required: true,
  };
}
