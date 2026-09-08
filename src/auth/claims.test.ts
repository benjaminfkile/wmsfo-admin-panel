import { describe, expect, it } from "vitest";
import type { User } from "oidc-client-ts";
import { roleOf, emailOf } from "./claims";

function makeUser(profile: Record<string, unknown>): User {
  return { profile } as unknown as User;
}

describe("roleOf", () => {
  it("returns admin when the user is in the admin group", () => {
    expect(roleOf(makeUser({ "cognito:groups": ["admin"] }))).toBe("admin");
  });

  it("returns editor when the user is only in the editor group", () => {
    expect(roleOf(makeUser({ "cognito:groups": ["editor"] }))).toBe("editor");
  });

  it("returns admin when the user is in both groups", () => {
    expect(
      roleOf(makeUser({ "cognito:groups": ["editor", "admin"] }))
    ).toBe("admin");
  });

  it("returns null when the group claim is absent", () => {
    expect(roleOf(makeUser({}))).toBeNull();
  });

  it("returns null when the group claim is not an array", () => {
    expect(roleOf(makeUser({ "cognito:groups": "admin" }))).toBeNull();
  });

  it("returns null when the user is only in an unknown group", () => {
    expect(roleOf(makeUser({ "cognito:groups": ["viewer"] }))).toBeNull();
  });
});

describe("emailOf", () => {
  it("returns the email string when present", () => {
    expect(emailOf(makeUser({ email: "a@b.com" }))).toBe("a@b.com");
  });

  it("returns an empty string when the email is missing", () => {
    expect(emailOf(makeUser({}))).toBe("");
  });
});
