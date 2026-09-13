import type { StatusId } from "../api/types";
import { formatMt } from "./time";

// The stock paragraph the API's email template ({{customMessage}}) uses
// when the admin does not type a custom message on a status change or
// announce (contracts 7.8, `EmailTemplates.StockParagraph`). Kept in
// sync with the API so `StatusDialog` and `NotifyDialog` can show the
// admin exactly what goes out.
export function stockParagraph(
  statusId: StatusId,
  eventName: string,
  scheduledAt: string | null
): string {
  const name = eventName || "The event";
  switch (statusId) {
    case 1:
      return `${name} is on the calendar. A specific time will be announced when it is known.`;
    case 2:
      return scheduledAt
        ? `${name} is scheduled. Lift-off is planned for ${formatMt(scheduledAt)} Mountain time.`
        : `${name} is scheduled.`;
    case 3:
      return `${name} is live. Watch Santa's flight now.`;
    case 4:
      return `${name} has ended. Thanks for flying along.`;
    case 5:
      return `${name} has been cancelled.`;
  }
}
