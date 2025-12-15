import { axiosClient } from "./axiosClient";

import { createDashboardConfigApi } from "./dashboardConfig";
import { createLiftoffApi } from "./liftoff";
import { createEventUpdatesApi } from "./eventUpdates";
import { createTrackingModeApi } from "./trackingMode";
import { createSponsorsApi } from "./sponsors";
import { createTrackiDeviceApi } from "./trackiDevice";
import { createLocationApi } from "./location";
import { createEventModeOverrideApi } from "./eventModeOverride";
import { createFundsApi } from "./funds";
import { createEventModeApi } from "./eventMode";

export const api = {
  liftoff: createLiftoffApi(axiosClient),
  funds: createFundsApi(axiosClient),
  eventUpdates: createEventUpdatesApi(axiosClient),
  trackingMode: createTrackingModeApi(axiosClient),
  sponsors: createSponsorsApi(axiosClient),
  trackiDevice: createTrackiDeviceApi(axiosClient),
  eventModeOverride: createEventModeOverrideApi(axiosClient),
  dashboardConfig: createDashboardConfigApi(axiosClient),
  location: createLocationApi(axiosClient),
  eventMode: createEventModeApi(axiosClient)
};
