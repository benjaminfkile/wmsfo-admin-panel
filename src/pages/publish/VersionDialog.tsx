import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { content as contentApi } from "../../api/resources/content";
import ErrorAlert from "../../components/ErrorAlert";
import { ThemedJsonView } from "../../components/ThemedJsonView";
import { formatMt } from "../../lib/time";

interface Props {
  open: boolean;
  versionId: number | null;
  onClose: () => void;
}

// Version view dialog (admin.md 6.18). Renders the document as a
// read-only tree (pages and their sections by kind and heading) plus
// the raw JSON in the ThemedJsonView.
export default function VersionDialog({ open, versionId, onClose }: Props) {
  const [tab, setTab] = useState<"tree" | "json">("tree");

  const versionQ = useQuery({
    queryKey: ["content", "version", versionId ?? -1],
    queryFn: () =>
      versionId !== null
        ? contentApi.version(versionId)
        : Promise.reject(new Error("no version id")),
    enabled: open && versionId !== null,
  });

  const document = versionQ.data?.document as
    | {
        settings?: Record<string, unknown>;
        pages?: Array<{
          slug?: string;
          title?: string;
          sections?: Array<{ kind?: string; data?: Record<string, unknown> }>;
        }>;
      }
    | undefined;

  const info = versionQ.data;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        {info ? (
          <>
            Version {String(info.id)} — {info.label ?? "(no label)"}
            <Typography variant="caption" display="block" color="text.secondary">
              Published by {info.publishedBy ?? "—"} at{" "}
              {formatMt(info.publishedAt ?? null)}
            </Typography>
          </>
        ) : (
          "Version"
        )}
      </DialogTitle>
      <DialogContent dividers>
        {versionQ.error ? (
          <ErrorAlert error={versionQ.error} />
        ) : versionQ.isLoading || !info ? (
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        ) : (
          <>
            <Tabs
              value={tab}
              onChange={(_, v: "tree" | "json") => setTab(v)}
              sx={{ mb: 2 }}
            >
              <Tab label="Overview" value="tree" />
              <Tab label="Raw JSON" value="json" />
            </Tabs>
            {tab === "tree" ? (
              <Stack spacing={2} data-testid="version-tree">
                <Box>
                  <Typography variant="subtitle2">Site settings</Typography>
                  <Box component="pre" sx={{ m: 0, fontSize: 12 }}>
                    {JSON.stringify(document?.settings ?? {}, null, 2)}
                  </Box>
                </Box>
                <Divider />
                <Box>
                  <Typography variant="subtitle2">Pages</Typography>
                  {(document?.pages ?? []).length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No pages.
                    </Typography>
                  ) : (
                    <List dense>
                      {(document?.pages ?? []).map((p) => (
                        <ListItem
                          key={String(p.slug ?? "")}
                          alignItems="flex-start"
                        >
                          <ListItemText
                            primary={`${p.title ?? "(untitled)"} — /${
                              p.slug ?? ""
                            }`}
                            secondary={
                              <Box component="span">
                                {(p.sections ?? []).map((s, i) => (
                                  <span key={i}>
                                    {i > 0 ? " · " : ""}
                                    {s.kind ?? ""}
                                  </span>
                                ))}
                                {(p.sections ?? []).length === 0
                                  ? "No sections"
                                  : null}
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              </Stack>
            ) : (
              <Box data-testid="version-json">
                <ThemedJsonView value={document ?? {}} />
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
