import { Link, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import { routes as routesApi } from "../../api/resources/routes";
import { keys } from "../../queries/keys";

// The event page's route line: an event carries no route, the whole site
// draws the published site route (GET /admin/route `published`), so the
// line names it, "Route: <name> (site setting)", or says "Route: none
// set", and links to Site settings, where it is chosen.
function siteRouteText(
  published: { routeId?: number | string; name?: string | null } | null | undefined
): string {
  if (!published) return "Route: none set";
  const name = published.name ?? `recording #${published.routeId}`;
  return `Route: ${name} (site setting)`;
}

export default function SiteRouteLine() {
  const siteQ = useQuery({ queryKey: keys.siteRoute, queryFn: () => routesApi.site() });
  if (!siteQ.isSuccess) return null;
  return (
    <Typography variant="body2" data-testid="event-site-route">
      <Link component={RouterLink} to="/site-settings">
        {siteRouteText(siteQ.data.published)}
      </Link>
    </Typography>
  );
}
