import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { useCompact } from "../../hooks/useCompact";
import HelpButton from "../../help/HelpButton";
import type { HelpKey } from "../../help/helpKeys";

interface Props {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  chips?: ReactNode;
  help?: HelpKey;
}

// The shared page-header row: title on the left with any chips beside it,
// actions on the right on desktop, wrapping to their own row full width on
// compact so a phone can still reach every button (the events page's
// "New event" is the driving example). `help` puts the page's help
// button after the chips.
export default function PageHeader({
  title,
  subtitle,
  actions,
  chips,
  help,
}: Props) {
  const compact = useCompact();
  return (
    <Stack sx={{ mb: 2 }} spacing={1}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        alignItems={{ xs: "stretch", md: "center" }}
        justifyContent="space-between"
        spacing={1}
        useFlexGap
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          sx={{ minWidth: 0 }}
        >
          <Typography
            variant={compact ? "h5" : "h4"}
            sx={{ minWidth: 0, wordBreak: "break-word" }}
          >
            {title}
          </Typography>
          {chips}
          {help !== undefined && <HelpButton topic={help} size="medium" />}
        </Stack>
        {actions !== undefined && !compact && (
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            sx={{ flexShrink: 0 }}
          >
            {actions}
          </Stack>
        )}
      </Stack>
      {actions !== undefined && compact && (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            width: "100%",
          }}
        >
          {actions}
        </Box>
      )}
      {subtitle !== undefined && <Box>{subtitle}</Box>}
    </Stack>
  );
}
