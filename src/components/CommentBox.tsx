import { Card, CardContent, Stack, Typography, useTheme } from "@mui/material";
import { ReactNode } from "react";
import HelpButton from "../help/HelpButton";
import type { HelpKey } from "../help/helpKeys";

type Variant = "info" | "warning" | "error";

interface Props {
  title?: string;
  variant?: Variant;
  children: ReactNode;
  help?: HelpKey;
}

// A note card with a coloured left edge. `help` puts a help button at the
// end of the title row.

export default function CommentBox({
  title,
  variant = "info",
  children,
  help,
}: Props) {
  const theme = useTheme();

  const palette = {
    info: theme.palette.info,
    warning: theme.palette.warning,
    error: theme.palette.error,
  }[variant];

  return (
    <Card
      sx={{
        mb: 3,
        borderLeft: `6px solid ${palette.main}`,
        backgroundColor:
          theme.palette.mode === "dark"
            ? theme.palette.background.paper
            : theme.palette.background.default,
      }}
    >
      <CardContent>
        {title && help === undefined && (
          <Typography
            fontWeight={700}
            sx={{ color: palette.main, mb: 1 }}
          >
            {title}
          </Typography>
        )}
        {title && help !== undefined && (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
            <Typography fontWeight={700} sx={{ color: palette.main }}>
              {title}
            </Typography>
            <HelpButton topic={help} />
          </Stack>
        )}

        <Typography
          variant="body2"
          sx={{ color: theme.palette.text.primary }}
        >
          {children}
        </Typography>
      </CardContent>
    </Card>
  );
}
