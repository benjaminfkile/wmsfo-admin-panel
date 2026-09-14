import { Dialog, useMediaQuery, useTheme, type DialogProps } from "@mui/material";

// Wrapper over MUI `Dialog` that turns on `fullScreen` below the `sm`
// breakpoint (600 px) unless the caller passes `fullScreen` in itself.
// The actions bar stays at the bottom and the content scrolls
// through `Dialog`'s own paper on full screen; MUI already lays it out
// that way for a full-screen dialog with `DialogContent` + `DialogActions`.
export default function AppDialog(props: DialogProps) {
  const theme = useTheme();
  const belowSm = useMediaQuery(theme.breakpoints.down("sm"));
  const { fullScreen, ...rest } = props;
  const effectiveFullScreen = fullScreen ?? belowSm;
  return <Dialog {...rest} fullScreen={effectiveFullScreen} />;
}
