import { get, patch, request } from "../client";
import type { TrackerMap } from "../types";

// The panel lists, renames, and deletes maps; the tile CLI creates them
// (admin.md 6.27). A delete with a replacement repoints every event
// using the map to it.
export const maps = {
  list: () => get<{ items: TrackerMap[] }>("/admin/maps"),
  rename: (id: number, name: string) =>
    patch<TrackerMap>(`/admin/maps/${id}`, { name }),
  remove: (id: number, replacementId: number | null) =>
    request<void>({
      method: "DELETE",
      path: `/admin/maps/${id}`,
      json: replacementId == null ? undefined : { replacementId },
      parse: "none",
    }),
};
