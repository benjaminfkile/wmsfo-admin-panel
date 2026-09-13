import { describe, expect, it } from "vitest";
import {
  diffFields,
  formatAction,
  formatActor,
  stampText,
  summariseEntry,
} from "./auditFormat";

describe("audit formatting (admin.md 1)", () => {
  it("strips person: and key: prefixes from actor and shows API keys as 'key <name>'", () => {
    expect(formatActor("person:alice@example.com")).toBe("alice@example.com");
    expect(formatActor("key:posting-bot")).toBe("key posting-bot");
    expect(formatActor("system")).toBe("system");
    expect(formatActor(null)).toBe("unknown");
  });

  it("capitalises the known action verbs", () => {
    expect(formatAction("create")).toBe("Create");
    expect(formatAction("delete")).toBe("Delete");
    expect(formatAction("unknown-verb")).toBe("Unknown-verb");
  });

  it("formats the stamp text or falls back when audit is null", () => {
    const s = stampText({ action: "update", by: "person:me", at: "2026-12-22T01:31:07.412Z" });
    expect(s).toMatch(/^Update by me · /);
    expect(stampText(null)).toBe("No changes recorded since the audit log began");
    expect(stampText(undefined)).toBe("No changes recorded since the audit log began");
  });

  it("diffs top-level scalar fields and summarises arrays and objects as 'changed'", () => {
    const before = { name: "A", count: 1, tags: ["x"], meta: { z: 1 } };
    const after = { name: "B", count: 1, tags: ["x", "y"], meta: { z: 2 } };
    const diffs = diffFields(before, after);
    expect(diffs.find((d) => d.field === "name")).toMatchObject({ before: "A", after: "B" });
    expect(diffs.find((d) => d.field === "tags")).toMatchObject({ before: "changed", after: "changed" });
    expect(diffs.find((d) => d.field === "meta")).toMatchObject({ before: "changed", after: "changed" });
    expect(diffs.find((d) => d.field === "count")).toBeUndefined();
  });

  it("summariseEntry renders the changed-fields summary", () => {
    const s = summariseEntry({
      id: 1,
      at: "2026-12-22T01:31:07.412Z",
      actor: "person:me",
      action: "update",
      entity: "sponsor",
      entityId: "4",
      before: { name: "A" },
      after: { name: "B" },
      requestId: null,
    });
    expect(s).toBe("name: A → B");
  });

  it("summariseEntry names deletes and creates", () => {
    expect(
      summariseEntry({
        id: 2,
        action: "delete",
        entity: "sponsor",
        entityId: "4",
        before: { name: "A" },
        after: null,
        actor: "person:me",
        at: "2026-12-22T01:31:07.412Z",
        requestId: null,
      })
    ).toMatch(/name: A/);
  });
});
