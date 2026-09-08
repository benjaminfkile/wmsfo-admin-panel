import { Card, CardContent, Typography, useTheme } from "@mui/material";
import { ReactNode } from "react";

type Variant = "info" | "warning" | "error";

interface Props {
  title?: string;
  variant?: Variant;
  children: ReactNode;
}

export default function CommentBox({
  title,
  variant = "info",
  children,
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
        {title && (
          <Typography
            fontWeight={700}
            sx={{ color: palette.main, mb: 1 }}
          >
            {title}
          </Typography>
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
