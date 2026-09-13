import { Box, Typography } from "@mui/material";
import type { QrDailyBucket } from "../../api/types";

interface Props {
  daily: QrDailyBucket[];
}

// admin.md 6.23: inline SVG daily chart, no chart library.
export default function DailyChart({ daily }: Props) {
  if (daily.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No scans yet.
      </Typography>
    );
  }

  const max = Math.max(1, ...daily.map((d) => d.people));
  const width = 560;
  const height = 160;
  const padX = 24;
  const padY = 20;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const barW = innerW / daily.length - 4;

  return (
    <Box sx={{ width: "100%", maxWidth: width }} data-testid="qr-daily-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Scans per day for the last 14 days"
        style={{ width: "100%", height: "auto" }}
      >
        {daily.map((d, i) => {
          const h = Math.max(1, (d.people / max) * innerH);
          const x = padX + i * (innerW / daily.length);
          const y = height - padY - h;
          return (
            <g key={d.day}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                fill="currentColor"
                opacity={0.7}
              >
                <title>{`${d.day}: ${d.people}`}</title>
              </rect>
              <text
                x={x + barW / 2}
                y={height - 6}
                textAnchor="middle"
                fontSize="8"
                fill="currentColor"
              >
                {d.day.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
    </Box>
  );
}
