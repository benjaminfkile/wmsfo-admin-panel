import { ApiError, NetworkError } from "../api/errors";

// Admin panel error code → user-facing text (admin.md 8.2). The table
// is the only place code strings are matched by string comparison;
// callers pass an `ApiError` or a raw code and get back copy suitable
// for the ErrorAlert.

export type ErrorCopy = {
  message: string;
  requestId: string | null;
  fields: Record<string, string>;
};

export type MessageContext = {
  // For codes whose copy folds in a live datum (e.g. rate_limited's
  // retry seconds, another_event_live's event name). Callers supply
  // whatever they have.
  liveEventName?: string;
  uploadLimitLabel?: string;
  allowedUploadTypes?: string;
};

export function toCopy(
  err: unknown,
  ctx: MessageContext = {}
): ErrorCopy {
  if (err instanceof NetworkError) {
    return { message: "API unreachable", requestId: null, fields: {} };
  }
  if (err instanceof ApiError) {
    return {
      message: messageForCode(err, ctx),
      requestId: err.requestId,
      fields: err.fields,
    };
  }
  return {
    message: err instanceof Error ? err.message : "Unexpected error",
    requestId: null,
    fields: {},
  };
}

function messageForCode(err: ApiError, ctx: MessageContext): string {
  const fallback = err.body?.message ?? `HTTP ${err.status}`;
  switch (err.code) {
    case "validation_failed":
      return err.body?.message ?? "Please check the highlighted fields.";
    case "unauthenticated":
      return "Signed out";
    case "forbidden":
      return "Not available for your role";
    case "mfa_required":
      return "Two-factor authentication is required";
    case "not_found":
      return "No longer exists";
    case "year_taken":
      return "An event for this year exists";
    case "scheduled_at_required":
      return "Required while the event is scheduled";
    case "event_status_unchanged":
      return "The event is already in that status";
    case "event_not_current":
      return "Only the current event can go live. Set it current first.";
    case "another_event_live":
      return ctx.liveEventName
        ? `Another event is live: ${ctx.liveEventName}`
        : "Another event is live";
    case "current_event_live":
      return "The current event is live. End it before changing the current event.";
    case "event_live":
      return "A live event cannot be deleted";
    case "event_has_locations":
      return "This event has recorded locations and cannot be deleted";
    case "route_in_use":
      return "Used by an event; unlink it there first";
    case "pinned_position_taken":
      return "That pinned position is taken for that year; use Sponsor order to rearrange";
    case "name_taken":
      return "That name is already in use";
    case "beacon_revoked":
      return "This beacon is revoked";
    case "slug_taken":
      return "That slug is already in use";
    case "slug_reserved":
      return "That slug is reserved";
    case "page_has_role":
      return "Status pages cannot be deleted";
    case "unknown_kind":
      return "Unknown section kind";
    case "kind_not_allowed":
      return "That section kind is not allowed on this page";
    case "content_unchanged":
      return "Nothing to publish";
    case "content_invalid":
      return "The draft has publish problems";
    case "media_not_ready":
      return "The selected media asset is not ready";
    case "media_not_pending":
      return "The upload has already been confirmed";
    case "upload_not_found":
      return "The uploaded file did not arrive";
    case "media_in_use":
      return "This asset is in use";
    case "preview_token_invalid":
      return "The preview link has expired";
    case "payload_too_large":
      return ctx.uploadLimitLabel
        ? `File too large. Limit: ${ctx.uploadLimitLabel}`
        : "The upload is too large";
    case "unsupported_media_type":
      return ctx.allowedUploadTypes
        ? `Unsupported file type. Allowed: ${ctx.allowedUploadTypes}`
        : "Unsupported file type";
    case "rate_limited": {
      const s = err.retryAfterSeconds ?? 0;
      return `Too many requests. Retry in ${s} s`;
    }
    case "snapshot_write_failed":
    case "route_write_failed":
    case "media_write_failed":
    case "upstream_failed":
      return "Storage write failed; nothing was saved. Try again.";
    case "internal_error":
      return err.body?.message ?? "The API returned an internal error";
    case "unavailable":
      return "The API is starting. Try again in a few seconds.";
    case "method_not_allowed":
    case "unknown":
      return `Unexpected response ${err.status}`;
    default:
      return fallback;
  }
}
