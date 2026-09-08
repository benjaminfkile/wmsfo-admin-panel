import { get } from "../client";
import type { IconInfo } from "../types";

export const icons = {
  list: () => get<{ items: IconInfo[] }>("/admin/icons"),
};
