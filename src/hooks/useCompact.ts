import { useMediaQuery, useTheme } from "@mui/material";

// The panel treats every viewport below the MUI `md` breakpoint (900 px) as
// the compact vocabulary: the temporary drawer, the row of one-per-line
// actions on `PageHeader`, and the full-screen dialog form (`AppDialog`
// applies the narrower `sm` cut-off for its own decision).
export function useCompact(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down("md"));
}
