import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import AppDialog from "./AppDialog";
import ErrorAlert from "./ErrorAlert";
import DialogTitleWithHelp from "../help/DialogTitleWithHelp";
import type { HelpKey } from "../help/helpKeys";
import { impact, type DeleteImpact, type ImpactGroup, type ImpactResource } from "../api/impact";

// A row another row can take over on delete (admin.md 8.3). A required
// replacement (a page holding a role) always shows and gates Delete; an
// optional one (a tracker map or theme) shows only when the impact
// unlinks something. The chosen id is handed back as `replacementId`.
export type Replacement = {
  label: string;
  candidates: Array<{ id: number; name: string }>;
  required?: boolean;
};

interface Props {
  open: boolean;
  resource: ImpactResource;
  id: number | string;
  name: string;
  confirmLabel?: string;
  replacement?: Replacement | null;
  disabled?: boolean;
  // A failed confirm, shown in the dialog's alert.
  error?: unknown;
  onCancel: () => void;
  onConfirm: (opts: { replacementId: number | null }) => void;
  help?: HelpKey;
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
  poster: { singular: "poster", plural: "posters" },
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
  replacement,
  disabled,
  error,
  onCancel,
  onConfirm,
  help,
}: Props) {
  const impactQ = useQuery({
    queryKey: ["impact", resource, String(id)],
    queryFn: () => impact.get(resource, id),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });

  const [replacementId, setReplacementId] = useState<number | "">("");
  useEffect(() => {
    if (open) setReplacementId("");
  }, [open, id]);

  const data: DeleteImpact | undefined = impactQ.data;
  const loaded = !!data;
  const blocked = data?.blocked ?? null;

  const deletes = useMemo(() => data?.deletes ?? [], [data]);
  const unlinks = useMemo(() => data?.unlinks ?? [], [data]);
  const warnings = useMemo(() => data?.warnings ?? [], [data]);

  const required = !!replacement?.required;
  const showReplacement =
    !!replacement && (required || unlinks.length > 0);
  const replacementOk = !required || typeof replacementId === "number";

  const confirmDisabled =
    !loaded ||
    !!blocked ||
    !!disabled ||
    !!impactQ.error ||
    !replacementOk;

  return (
    <AppDialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      {help === undefined ? (
        <DialogTitle>{`Delete ${name}?`}</DialogTitle>
      ) : (
        <DialogTitleWithHelp help={help}>{`Delete ${name}?`}</DialogTitleWithHelp>
      )}
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

            {showReplacement ? (
              <TextField
                select
                required={required}
                label={replacement!.label}
                value={replacementId === "" ? "" : String(replacementId)}
                onChange={(e) =>
                  setReplacementId(
                    e.target.value === "" ? "" : Number(e.target.value)
                  )
                }
                fullWidth
              >
                {required ? null : (
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                )}
                {required && replacement!.candidates.length === 0 ? (
                  <MenuItem value="" disabled>
                    Nothing to choose from
                  </MenuItem>
                ) : (
                  replacement!.candidates.map((c) => (
                    <MenuItem key={String(c.id)} value={String(c.id)}>
                      {c.name}
                    </MenuItem>
                  ))
                )}
              </TextField>
            ) : null}

            {error ? <ErrorAlert error={error} /> : null}
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
                replacementId:
                  showReplacement && typeof replacementId === "number"
                    ? replacementId
                    : null,
              })
            }
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        )}
      </DialogActions>
    </AppDialog>
  );
}
