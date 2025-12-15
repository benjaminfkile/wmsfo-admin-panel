import { AxiosInstance } from "axios";
import { ITrackingMode } from "../interfaces";

export const createTrackingModeApi = (c: AxiosInstance) => ({
  // GET /api/{prefix}/tracking-mode/modes
  getModes(): Promise<ITrackingMode[]> {
    return c
      .get<ITrackingMode[]>(
        "/api/tracking-mode/modes",
        { requiresPrefix: true }
      )
      .then((res) => res.data);
  },

  // POST /api/{prefix}/tracking-mode/modes
  activate(trackingModeTypeId: number): Promise<void> {
    return c.post(
      "/api/tracking-mode/modes",
      {
        tracking_mode_type_id: trackingModeTypeId,
        is_active: true,
      },
      { requiresPrefix: true }
    );
  },
});
