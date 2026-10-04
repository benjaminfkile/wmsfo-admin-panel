import { Box, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import type { MediaUsage } from "../../api/types";

interface Props {
  usage: MediaUsage;
}

// Renders the media usage document: draft pages as links to their
// editors, version count, sponsors, cookie types, and site settings.
export default function UsageList({ usage }: Props) {
  const pages = usage.draftPages ?? [];
  const sponsors = usage.sponsors ?? [];
  const cookieTypes = usage.cookieTypes ?? [];
  const versionCount = normNumber(usage.versionCount);
  const inSiteSettings = usage.siteSettings === true;

  const empty =
    pages.length === 0 &&
    sponsors.length === 0 &&
    cookieTypes.length === 0 &&
    versionCount === 0 &&
    !inSiteSettings;
  if (empty) {
    return (
      <Typography variant="body2" color="text.secondary">
        Not used anywhere.
      </Typography>
    );
  }
  return (
    <Stack spacing={1}>
      {pages.length > 0 ? (
        <Box>
          <Typography variant="body2" fontWeight="medium">
            Draft pages
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 3 }}>
            {pages.map((p) => (
              <li key={String(p.id)}>
                <Link
                  component={RouterLink}
                  to={`/pages/${p.id}`}
                  variant="body2"
                >
                  {p.title ?? p.slug}
                </Link>
              </li>
            ))}
          </Box>
        </Box>
      ) : null}
      {versionCount > 0 ? (
        <Typography variant="body2">
          Held by {versionCount} published version{versionCount === 1 ? "" : "s"}
        </Typography>
      ) : null}
      {sponsors.length > 0 ? (
        <Box>
          <Typography variant="body2" fontWeight="medium">
            Sponsors
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 3 }}>
            {sponsors.map((s) => (
              <li key={String(s.id)}>
                <Typography variant="body2" component="span">
                  {s.name ?? `#${s.id}`}
                </Typography>
              </li>
            ))}
          </Box>
        </Box>
      ) : null}
      {cookieTypes.length > 0 ? (
        <Box>
          <Typography variant="body2" fontWeight="medium">
            Cookie types
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 3 }}>
            {cookieTypes.map((c) => (
              <li key={String(c.id)}>
                <Typography variant="body2" component="span">
                  {c.name ?? `#${c.id}`}
                </Typography>
              </li>
            ))}
          </Box>
        </Box>
      ) : null}
      {inSiteSettings ? (
        <Typography variant="body2">Referenced by site settings</Typography>
      ) : null}
    </Stack>
  );
}

function normNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
