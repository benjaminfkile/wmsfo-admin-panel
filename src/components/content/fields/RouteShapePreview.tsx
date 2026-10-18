import { Box } from "@mui/material";
import type { LatLng } from "../../../routeMap";
import { shapePoints } from "../siteRoute";

interface Props {
  path: readonly LatLng[];
  width?: number;
  height?: number;
}

// The small preview of the site route on the Site settings Route card:
// the route's path as a line, with a dot at the start, no basemap.
export default function RouteShapePreview({ path, width = 240, height = 160 }: Props) {
  const points = shapePoints(path, width, height);
  const start = points.split(" ")[0]?.split(",");
  return (
    <Box
      component="svg"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="Route preview"
      data-testid="site-route-preview"
      sx={{ display: "block", maxWidth: "100%", bgcolor: "action.hover", borderRadius: 1 }}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {start && start.length === 2 ? <circle cx={start[0]} cy={start[1]} r={3.5} fill="currentColor" /> : null}
    </Box>
  );
}
