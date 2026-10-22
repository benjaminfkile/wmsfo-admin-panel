import type { Beacon, Event, StatusId } from "../api/types";
import { formatStamp } from "./time";

// The status change gates shared by the event page's buttons and the
// dashboard's Change status menu (admin.md 6.2, 6.3). Each mirrors a
// 409 of POST /admin/events/{id}/status, so the panel disables the
// target before the API would refuse it.

export const SCHEDULED_AT_PAST_REASON =
  "The scheduled time has passed. Set a new one first";

// Null when the panel can confirm a healthy, active beacon; otherwise
// the reason for the tooltip and the dialog's gate.
export function healthyBeaconReason(activeBeacon: Beacon | null): string | null {
  if (activeBeacon === null) return "none is active";
  const name = activeBeacon.name ?? "the active beacon";
  if (activeBeacon.revokedAt !== null && activeBeacon.revokedAt !== undefined) {
    return `${name} is revoked`;
  }
  if (activeBeacon.staleSince !== null && activeBeacon.staleSince !== undefined) {
    return `${name} is stale since ${formatStamp(activeBeacon.staleSince)}`;
  }
  if (
    activeBeacon.lastHeartbeatAt === null ||
    activeBeacon.lastHeartbeatAt === undefined
  ) {
    return `${name} has never been heard from`;
  }
  if (activeBeacon.healthy !== true) {
    return `${name} is not healthy`;
  }
  return null;
}

// The reason the change to `target` is disabled, or null when it is
// allowed. `now` is epoch milliseconds.
export function statusDisabledReason(
  target: StatusId,
  event: Event,
  eventsList: Event[],
  activeBeacon: Beacon | null,
  now: number
): string | null {
  if (target === 2) {
    if (!event.scheduledAt) return "Set a scheduled time first";
    const at = Date.parse(event.scheduledAt);
    if (Number.isFinite(at) && at <= now) return SCHEDULED_AT_PAST_REASON;
    return null;
  }
  if (target === 3) {
    if (!event.isCurrent) return "Set this event current first";
    const live = eventsList.find(
      (e) => Number(e.statusId) === 3 && Number(e.id) !== Number(event.id)
    );
    if (live) return `${live.name ?? "Another event"} is live`;
    const reason = healthyBeaconReason(activeBeacon);
    if (reason !== null) return `No healthy active beacon: ${reason}`;
  }
  return null;
}
