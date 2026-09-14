import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import ErrorAlert from "./ErrorAlert";
import { impact, type DeleteImpact, type ImpactGroup, type ImpactResource } from "../api/impact";

// A page holding a role must hand it to another page before it can be
// deleted (admin.md 8.3). The dialog surfaces a required select over the
// candidate pages and hands the id back to the caller as `roleTo`.
export type RoleTakeover = {
  role: string;
  candidates: Array<{ id: number; title: string }>;
};

interface Props {
  open: boolean;
  resource: ImpactResource;
  id: number | string;
  name: string;
  confirmLabel?: string;
  roleTakeover?: RoleTakeover | null;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: (opts: { roleTo: number | null }) => void;
}

const ENTITY_LABELS: Record<string, { singular: string; plural: string }> = {
  cookie: { singular: "cookie", plural: "cookies" },
  event_message: { singular: "message", plural: "messages" },
  event_status_history: { singular: "status change", plural: "status changes" },
  location: { singular: "location", plural: "locations" },
  event: { singular: "event", plural: "events" },
  section: { singular: "section", plural: "sections" },
  section_item: { singular: "item", plural: "items" },
  page: { singular: "page", plural: "pages" },
  route: { singular: "recording", plural: "recordings" },
  media_asset: { singular: "media asset", plural: "media assets" },
  qr_code: { singular: "QR code", plural: "QR codes" },
  place: { singular: "place", plural: "places" },
  attachment: { singular: "attachment", plural: "attachments" },
  sponsor: { singular: "sponsor", plural: "sponsors" },
  sponsor_year: { singular: "sponsor year", plural: "sponsor years" },
  cookie_type: { singular: "cookie type", plural: "cookie types" },
  api_key: { singular: "API key", plural: "API keys" },
  beacon: { singular: "beacon", plural: "beacons" },
  subscriber: { singular: "subscriber", plural: "subscribers" },
  subscription: { singular: "subscription", plural: "subscriptions" },
  person: { singular: "person", plural: "people" },
  contact_message: { singular: "contact message", plural: "contact messages" },
};

function labelFor(entity: string, count: number): string {
  const words = ENTITY_LABELS[entity];
  if (!words) {
    // Fallback: humanize the entity kind with a plural s.
    const humanized = entity.replace(/_/g, " ");
    return count === 1 ? humanized : `${humanized}s`;
  }
  return count === 1 ? words.singular : words.plural;
}

function unlinkVerb(entity: string, count: number): string {
  const noun = labelFor(entity, count);
  return count === 1 ? `${count} ${noun} loses its reference` : `${count} ${noun} lose their reference`;
}

function formatDeletesLine(group: ImpactGroup): string {
  const noun = labelFor(group.entity, group.count);
  const head = `${group.count} ${noun}`;
  const shown = group.names.slice(0, 10).filter((n) => n.length > 0);
  if (shown.length === 0) return head;
  const more =
    group.count > shown.length ? `, +${group.count - shown.length} more` : "";
  return `${head}: ${shown.join(", ")}${more}`;
}

function formatUnlinksLine(group: ImpactGroup): string {
  const head = unlinkVerb(group.entity, group.count);
  const shown = group.names.slice(0, 10).filter((n) => n.length > 0);
  if (shown.length === 0) return head;
  const more =
    group.count > shown.length ? `, +${group.count - shown.length} more` : "";
  return `${head}: ${shown.join(", ")}${more}`;
}

export default function DeleteDialog({
  open,
  resource,
  id,
  name,
  confirmLabel = "Delete",
  roleTakeover,
  disabled,
  onCancel,
  onConfirm,
}: Props) {
  const impactQ = useQuery({
    queryKey: ["impact", resource, String(id)],
    queryFn: () => impact.get(resource, id),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });

  const [roleTo, setRoleTo] = useState<number | "">("");
  useEffect(() => {
    if (open) setRoleTo("");
  }, [open, id]);

  const data: DeleteImpact | undefined = impactQ.data;
  const loaded = !!data;
  const blocked = data?.blocked ?? null;

  const needsRoleTo = roleTakeover !== undefined && roleTakeover !== null;
  const roleToOk = !needsRoleTo || (typeof roleTo === "number");

  const confirmDisabled =
    !loaded ||
    !!blocked ||
    !!disabled ||
    !!impactQ.error ||
    !roleToOk;

  const deletes = useMemo(() => data?.deletes ?? [], [data]);
  const unlinks = useMemo(() => data?.unlinks ?? [], [data]);
  const warnings = useMemo(() => data?.warnings ?? [], [data]);

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{`Delete ${name}?`}</DialogTitle>
      <DialogContent>
        {impactQ.isLoading ? (
          <Stack alignItems="center" sx={{ py: 3 }}>
            <CircularProgress size={24} />
          </Stack>
        ) : impactQ.error ? (
          <ErrorAlert error={impactQ.error} />
        ) : blocked ? (
          <Alert severity="warning">{blocked}</Alert>
        ) : (
          <Stack spacing={2}>
            {warnings.length > 0 ? (
              <Alert severity="error">
                <Stack spacing={0.5}>
                  {warnings.map((w, i) => (
                    <Typography key={i} variant="body2">
                      {w}
                    </Typography>
                  ))}
                </Stack>
              </Alert>
            ) : null}

            {deletes.length === 0 && unlinks.length === 0 ? (
              <Typography variant="body2">Nothing else is affected.</Typography>
            ) : (
              <>
                {deletes.length > 0 ? (
                  <Box>
                    <Typography variant="subtitle2">Also deleted</Typography>
                    <Stack component="ul" spacing={0.5} sx={{ pl: 3, my: 1 }}>
                      {deletes.map((g, i) => (
                        <li key={i}>
                          <Typography variant="body2">{formatDeletesLine(g)}</Typography>
                        </li>
                      ))}
                    </Stack>
                  </Box>
                ) : null}
                {unlinks.length > 0 ? (
                  <Box>
                    <Typography variant="subtitle2">Unlinked</Typography>
                    <Stack component="ul" spacing={0.5} sx={{ pl: 3, my: 1 }}>
                      {unlinks.map((g, i) => (
                        <li key={i}>
                          <Typography variant="body2">{formatUnlinksLine(g)}</Typography>
                        </li>
                      ))}
                    </Stack>
                  </Box>
                ) : null}
              </>
            )}

            {needsRoleTo ? (
              <TextField
                select
                required
                label={`Page that takes the ${roleTakeover!.role} role`}
                value={roleTo === "" ? "" : String(roleTo)}
                onChange={(e) =>
                  setRoleTo(e.target.value === "" ? "" : Number(e.target.value))
                }
                fullWidth
              >
                {roleTakeover!.candidates.length === 0 ? (
                  <MenuItem value="" disabled>
                    No other pages to hand the role to
                  </MenuItem>
                ) : (
                  roleTakeover!.candidates.map((c) => (
                    <MenuItem key={String(c.id)} value={String(c.id)}>
                      {c.title}
                    </MenuItem>
                  ))
                )}
              </TextField>
            ) : null}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{blocked ? "Close" : "Cancel"}</Button>
        {blocked ? null : (
          <Button
            color="error"
            variant="contained"
            onClick={() =>
              onConfirm({
                roleTo: needsRoleTo && typeof roleTo === "number" ? roleTo : null,
              })
            }
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
