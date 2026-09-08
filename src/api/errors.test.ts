import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";

describe("ApiError", () => {
  it("uses the body message when present", () => {
    const err = new ApiError(400, {
      code: "validation_failed",
      message: "lat must be between -90 and 90",
      details: { fields: { lat: "must be between -90 and 90" } },
      requestId: "req-1",
    });
    expect(err.message).toBe("lat must be between -90 and 90");
    expect(err.code).toBe("validation_failed");
    expect(err.requestId).toBe("req-1");
    expect(err.fields).toEqual({ lat: "must be between -90 and 90" });
  });

  it("falls back to HTTP status when no body", () => {
    const err = new ApiError(500, null);
    expect(err.message).toBe("HTTP 500");
    expect(err.code).toBe("unknown");
    expect(err.requestId).toBeNull();
    expect(err.fields).toEqual({});
    expect(err.retryAfterSeconds).toBeNull();
  });

  it("maps 405 to method_not_allowed when body is absent", () => {
    const err = new ApiError(405, null);
    expect(err.code).toBe("method_not_allowed");
  });

  it("filters non-string entries out of fields", () => {
    const err = new ApiError(400, {
      code: "validation_failed",
      message: "bad",
      details: { fields: { a: "x", b: 5, c: null } as Record<string, unknown> },
      requestId: "req-2",
    });
    expect(err.fields).toEqual({ a: "x" });
  });

  it("reads retryAfterSeconds from details", () => {
    const err = new ApiError(429, {
      code: "rate_limited",
      message: "slow down",
      details: { retryAfterSeconds: 12 },
      requestId: "req-3",
    });
    expect(err.retryAfterSeconds).toBe(12);
  });

  it("returns null retryAfterSeconds when the field is missing", () => {
    const err = new ApiError(500, {
      code: "internal_error",
      message: "boom",
      details: null,
      requestId: "req-4",
    });
    expect(err.retryAfterSeconds).toBeNull();
  });
});
