import { useEffect, useState, ReactNode } from "react";
import { Card, CardContent, Typography, Box, Link } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { api } from "../../api";
import { IEventModeOverride } from "../../interfaces";
import CommentBox from "./CommentBox";

interface Props {
  override?: IEventModeOverride | null;
  comments?: ReactNode;
  showLink?: boolean;
}

const EVENT_MODE_LABELS: Record<number, string> = {
  0: "Pre-Show",
  1: "Run-Show",
  2: "End-Show",
};

export default function EventModeOverrideWarning({
  override,
  comments,
  showLink = false
}: Props) {
  const [activeOverride, setActiveOverride] =
    useState<IEventModeOverride | null>(override ?? null);

  useEffect(() => {
    if (override !== undefined) {
      setActiveOverride(override);
      return;
    }

    api.eventModeOverride
      .getActive()
      .then(setActiveOverride)
      .catch(() => setActiveOverride(null));
  }, [override]);

  if (!activeOverride) return null;

  return (
    <Box mb={3}>
      <Card
        sx={{
          border: "2px solid",
          borderColor: "error.main",
          animation: "overridePulse 1.5s ease-in-out infinite",
          "@keyframes overridePulse": {
            "0%": { boxShadow: "0 0 0 0 rgba(211,47,47,0.4)" },
            "70%": { boxShadow: "0 0 0 10px rgba(211,47,47,0)" },
            "100%": { boxShadow: "0 0 0 0 rgba(211,47,47,0)" },
          },
        }}
      >
        <CardContent>
          <Typography color="error" fontWeight={700}>
            ⚠️ EVENT MODE OVERRIDE ACTIVE
          </Typography>

          <Typography sx={{ mt: 1 }}>
            Mode:{" "}
            <strong>
              {EVENT_MODE_LABELS[activeOverride.mode] ??
                `Unknown (${activeOverride.mode})`}
            </strong>
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Expires at:{" "}
            {new Date(activeOverride.expires_at).toLocaleString()}
          </Typography>

          {showLink && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              <Link
                component={RouterLink}
                to="/event-mode-override"
                underline="hover"
              >
                Manage event mode override
              </Link>
            </Typography>
          )}
        </CardContent>
      </Card>

      {comments && (
        <Box mt={2}>
          <CommentBox variant="warning" title="Important Behavior">
            {comments}
          </CommentBox>
        </Box>
      )}
    </Box>
  );
}
