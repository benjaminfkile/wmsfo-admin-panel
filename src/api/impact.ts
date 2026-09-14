import { get } from "./client";

export type ImpactGroup = {
  entity: string;
  count: number;
  names: string[];
};

export type DeleteImpact = {
  blocked: string | null;
  deletes: ImpactGroup[];
  unlinks: ImpactGroup[];
  warnings: string[];
};

// The resources with a `GET /admin/<resource>/{id}/impact` endpoint
// (contracts 4.5, admin.md 8.3). The dialog picks its URL from this
// map so callers pass a symbolic kind rather than assembling paths.
export type ImpactResource =
  | "events"
  | "routes"
  | "sponsors"
  | "cookie-types"
  | "pages"
  | "media"
  | "places"
  | "qr-codes"
  | "beacons"
  | "api-keys"
  | "subscribers"
  | "people"
  | "contact-messages";

export const impact = {
  get: (resource: ImpactResource, id: number | string) =>
    get<DeleteImpact>(`/admin/${resource}/${id}/impact`),
};
