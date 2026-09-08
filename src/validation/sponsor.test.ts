import { describe, expect, it } from "vitest";
import {
  toSponsorBody,
  toSponsorYearBody,
  validateSponsor,
  validateSponsorYear,
  type SponsorInput,
  type SponsorYearInput,
} from "./sponsor";

const EMPTY: SponsorInput = {
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  websiteUrl: "",
  fbUrl: "",
  igUrl: "",
};

describe("validateSponsor", () => {
  it("requires the name", () => {
    expect(validateSponsor({ ...EMPTY }).name).toBeDefined();
  });

  it("caps the name at 200", () => {
    expect(
      validateSponsor({ ...EMPTY, name: "a".repeat(201) }).name
    ).toBeDefined();
    expect(
      validateSponsor({ ...EMPTY, name: "a".repeat(200) }).name
    ).toBeUndefined();
  });

  it("accepts an empty URL as valid (optional)", () => {
    expect(validateSponsor({ ...EMPTY, name: "x" })).toEqual({});
  });

  it("rejects a non-http URL", () => {
    expect(
      validateSponsor({ ...EMPTY, name: "x", websiteUrl: "ftp://ex.com" })
        .websiteUrl
    ).toBeDefined();
  });

  it("accepts a valid https URL", () => {
    expect(
      validateSponsor({ ...EMPTY, name: "x", fbUrl: "https://fb.example" })
        .fbUrl
    ).toBeUndefined();
  });
});

describe("toSponsorBody", () => {
  it("converts empty optional fields to null", () => {
    const body = toSponsorBody({ ...EMPTY, name: "Acme" });
    expect(body.name).toBe("Acme");
    expect(body.email).toBeNull();
    expect(body.websiteUrl).toBeNull();
  });

  it("trims whitespace", () => {
    const body = toSponsorBody({ ...EMPTY, name: "  Acme  " });
    expect(body.name).toBe("Acme");
  });
});

const EMPTY_YEAR: SponsorYearInput = {
  eventYear: "",
  amountDonated: "",
  active: true,
  canAdvertise: true,
  anonymous: false,
};

describe("validateSponsorYear", () => {
  it("requires a year in 2000..2100", () => {
    expect(validateSponsorYear({ ...EMPTY_YEAR }).eventYear).toBeDefined();
    expect(
      validateSponsorYear({ ...EMPTY_YEAR, eventYear: "1999" }).eventYear
    ).toBeDefined();
    expect(
      validateSponsorYear({ ...EMPTY_YEAR, eventYear: "2101" }).eventYear
    ).toBeDefined();
    expect(
      validateSponsorYear({ ...EMPTY_YEAR, eventYear: "2026" }).eventYear
    ).toBeUndefined();
  });

  it("permits empty amountDonated", () => {
    expect(
      validateSponsorYear({ ...EMPTY_YEAR, eventYear: "2026" }).amountDonated
    ).toBeUndefined();
  });

  it("rejects an amount with three decimals", () => {
    expect(
      validateSponsorYear({
        ...EMPTY_YEAR,
        eventYear: "2026",
        amountDonated: "1.234",
      }).amountDonated
    ).toBeDefined();
  });

  it("rejects an amount over 1_000_000_000", () => {
    expect(
      validateSponsorYear({
        ...EMPTY_YEAR,
        eventYear: "2026",
        amountDonated: "1000000001",
      }).amountDonated
    ).toBeDefined();
  });
});

describe("toSponsorYearBody", () => {
  it("empty amount becomes null", () => {
    expect(
      toSponsorYearBody({ ...EMPTY_YEAR, eventYear: "2026" }).amountDonated
    ).toBeNull();
  });

  it("carries the four fields", () => {
    const body = toSponsorYearBody({
      ...EMPTY_YEAR,
      eventYear: "2026",
      amountDonated: "42.5",
      anonymous: true,
    });
    expect(body).toEqual({
      amountDonated: 42.5,
      active: true,
      canAdvertise: true,
      anonymous: true,
    });
  });
});
