const trackingModes = [
  {
    id: 1,
    mode_name: "Primary (Legacy Cell Phone)",
    description: "Uses gpsLocationCache (default / primary tracker)",
  },
  {
    id: 2,
    mode_name: "Secondary (TrackiPro)",
    description: "Fallback GPS via TrackiPro device",
  },
  // {
  //   id: 3,
  //   mode_name: "Simulator",
  //   description: "Simulates a flight",
  // },
] as const;

export default trackingModes;
