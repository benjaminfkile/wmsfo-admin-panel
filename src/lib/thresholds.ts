// Beacon flag thresholds published by the API repository and
// vendored at contracts/admin-thresholds.json (admin.md 5.2 / 11).
// The JSON lives outside src, so the values are re-declared here and
// a runtime check keeps them in sync with the vendored copy through
// the check:contracts script.

export type Thresholds = {
  batteryLowPercent: number;
  noFixAgeS: number;
  noLocationAgeS: number;
};

export const thresholds: Thresholds = {
  batteryLowPercent: 20,
  noFixAgeS: 30,
  noLocationAgeS: 30,
};
