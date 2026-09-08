import { describe, expect, it } from "vitest";
import { csvFromRecords, csvJoin, csvRow } from "./csv";

describe("csvRow", () => {
  it("joins simple values", () => {
    expect(csvRow(["a", "b", 1, true])).toBe("a,b,1,true");
  });

  it("quotes cells containing commas, quotes, and newlines", () => {
    expect(csvRow(["a,b", 'say "hi"', "line\nbreak"])).toBe(
      '"a,b","say ""hi""","line\nbreak"'
    );
  });

  it("renders null and undefined as empty strings", () => {
    expect(csvRow([null, undefined, "x"])).toBe(",,x");
  });
});

describe("csvJoin", () => {
  it("terminates each row with CRLF (RFC 4180)", () => {
    expect(csvJoin([["a", "b"], ["c", "d"]])).toBe("a,b\r\nc,d\r\n");
  });

  it("returns empty for no rows", () => {
    expect(csvJoin([])).toBe("");
  });
});

describe("csvFromRecords", () => {
  it("uses the header order and pulls values by key", () => {
    const rows = [
      { seq: 1, lat: 46.87, lng: -114 },
      { seq: 2, lat: 46.88, lng: -114.1 },
    ];
    const out = csvFromRecords(["seq", "lat", "lng"], rows);
    expect(out).toBe("seq,lat,lng\r\n1,46.87,-114\r\n2,46.88,-114.1\r\n");
  });
});
