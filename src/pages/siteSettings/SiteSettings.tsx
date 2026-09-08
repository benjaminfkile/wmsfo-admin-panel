import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UiSchema } from "@rjsf/utils";
import { siteSettings as siteSettingsApi } from "../../api/resources/siteSettings";
import { keys } from "../../queries/keys";
import CommentBox from "../../components/CommentBox";
import ErrorAlert from "../../components/ErrorAlert";
import SchemaForm from "../../components/content/SchemaForm";
import PreviewFrame from "../../components/content/PreviewFrame";
import ProblemList from "../../components/content/ProblemList";
import { useNotify } from "../../hooks/useNotify";
import siteSettingsSchema from "../../../contracts/schema/site-settings.schema.json";
import type { Problem } from "../../api/types";

const SCHEMA = siteSettingsSchema as Record<string, unknown>;

// UiSchema hands the theme object off to the ThemeField and gives the
// heavier text areas some room.
const UI_SCHEMA: UiSchema = {
  theme: { "ui:field": "ThemeField" },
  footerText: { "ui:options": { rows: 3 } },
};

// Site settings page (admin.md 6.16). One SchemaForm over the vendored
// site-settings schema with the shared custom fields plus ThemeField
// for the theme object. Save PUTs the whole document; problems from
// GET render inline. Preview opens the site's home page.
export default function SiteSettings() {
  const qc = useQueryClient();
  const notify = useNotify();
  const [data, setData] = useState<Record<string, unknown>>({});
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const draftQ = useQuery({
    queryKey: keys.siteSettings,
    queryFn: () => siteSettingsApi.get(),
  });

  useEffect(() => {
    const incoming = (draftQ.data?.data ?? {}) as Record<string, unknown>;
    setData(incoming);
    setDirty(false);
  }, [draftQ.data]);

  const saveMut = useMutation({
    mutationFn: () => siteSettingsApi.put(data),
    onSuccess: (row) => {
      notify("Site settings saved");
      setDirty(false);
      qc.setQueryData(keys.siteSettings, row);
      void qc.invalidateQueries({ queryKey: keys.contentStatus });
    },
  });

  const problems: Problem[] = draftQ.data?.problems ?? [];

  return (
    <>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography variant="h4">Site settings</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            onClick={() => setPreviewOpen(true)}
            data-testid="site-settings-preview"
          >
            Preview
          </Button>
          <Button
            variant="contained"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !dirty}
            data-testid="site-settings-save"
          >
            {saveMut.isPending ? "Saving…" : "Save"}
          </Button>
        </Stack>
      </Stack>
      <CommentBox variant="info">
        Settings are drafts until you publish.
      </CommentBox>
      {draftQ.error ? (
        <ErrorAlert error={draftQ.error} />
      ) : (
        <>
          {saveMut.error ? <ErrorAlert error={saveMut.error} /> : null}
          {problems.length > 0 ? (
            <Box sx={{ mb: 2 }} data-testid="site-settings-problems">
              <Paper sx={{ p: 2 }} variant="outlined">
                <Typography variant="subtitle2" color="error" gutterBottom>
                  {problems.length} problem{problems.length === 1 ? "" : "s"}
                </Typography>
                <ProblemList problems={problems} />
              </Paper>
            </Box>
          ) : null}
          <Paper sx={{ p: 2 }} variant="outlined">
            <SchemaForm
              schema={SCHEMA as Record<string, unknown>}
              uiSchema={UI_SCHEMA}
              formData={data}
              onChange={(next: Record<string, unknown>) => {
                setData(next);
                setDirty(true);
              }}
              hideSubmit
            />
          </Paper>
        </>
      )}
      <PreviewFrame
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        initialSlug={null}
        title="Preview site settings"
      />
    </>
  );
}
