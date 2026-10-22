import { describe, expect, it } from "vitest";
import { ApiError } from "../api/errors";
import { toCopy } from "./errorMessages";

function apiError(code: string, status = 409): ApiError {
  return new ApiError(status, {
    code,
    message: `server text for ${code}`,
    details: null,
    requestId: "req-1",
  });
}

describe("toCopy", () => {
  it("maps scheduled_at_past to the panel's own sentence", () => {
    const copy = toCopy(apiError("scheduled_at_past"));
    expect(copy.message).toBe(
      "The scheduled time has passed. Set a new one first."
    );
    expect(copy.requestId).toBe("req-1");
  });

  it("keeps scheduled_at_required as before", () => {
    expect(toCopy(apiError("scheduled_at_required")).message).toBe(
      "Required while the event is scheduled"
    );
  });

  it("falls back to the body message for an unknown code", () => {
    expect(toCopy(apiError("something_new")).message).toBe(
      "server text for something_new"
    );
  });
});
