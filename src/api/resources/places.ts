import { get } from "../client";
import type { Place } from "../types";

// M29 needs only the tree list for the QR-codes places picker. Full
// CRUD lands in M30.
export const places = {
  list: () => get<{ items: Place[] }>("/admin/places"),
};
