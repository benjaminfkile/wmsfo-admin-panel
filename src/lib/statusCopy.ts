import type { StatusId } from "../api/types";

// The stock paragraph the API's email template ({{customMessage}}) uses
// when the admin does not type a custom message on a status change or
// announce (contracts 7.8, `EmailTemplates.StockParagraph`). Kept in
// sync with the API by hand so `StatusDialog` and `NotifyDialog` can show
// the admin exactly what goes out. The scheduled paragraph carries no
// time (A109): the site shows the time in the visitor's zone on its own.
export function stockParagraph(statusId: StatusId, eventName: string): string {
  const name = eventName || "The event";
  switch (statusId) {
    case 1:
      return `${name} is in the works. Santa is checking his list twice, and the date will be announced as soon as it is set.`;
    case 2:
      return `${name} is scheduled.`;
    case 3:
      return `${name} is live. Watch Santa's flight now.`;
    case 4:
      return `${name} has ended. Thanks for flying along.`;
    case 5:
      return `${name} has been cancelled.`;
    case 6:
      return `${name} is postponed. A new time will be announced when it is known.`;
  }
}

// Helper line under the message field of `StatusDialog` and
// `NotifyDialog`: the typed text becomes an event message on the site.
export const MESSAGE_HELPER =
  "Posted on the site as the latest message. With notify it replaces the stock paragraph in the email.";
