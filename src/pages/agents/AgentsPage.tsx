// docs/admin.md section 6.21. Agents: how a session with an agent works
// (mint a key, hand it over, revoke it after), the keys table in place, and
// the prompt that teaches the agent the admin API, with the base URL this
// build talks to already filled in.

import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import { useConfig } from "../../ConfigContext";
import ApiKeysList from "../apiKeys/ApiKeysList";
import { buildAgentPrompt } from "./agentPrompt";

export default function AgentsPage() {
  const config = useConfig();
  const prompt = useMemo(() => buildAgentPrompt(config.apiBaseUrl), [config.apiBaseUrl]);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch {
      // Clipboard blocked: the prompt stays on the page to copy by hand.
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1">
          Agents
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
          Run an agent against the admin API for one session: mint a key with only the
          capabilities the job needs, give the agent the key and the prompt below, let it
          work, then revoke the key.
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3, maxWidth: 720 }}>
        <Typography variant="subtitle2" gutterBottom>
          How a session works
        </Typography>
        <Typography variant="body2" component="div">
          <ol style={{ margin: 0, paddingLeft: "1.25rem" }}>
            <li>
              Mint a key below. Pick the capabilities the job needs (content work is pages,
              sections, media, icons, and publish) and an expiry. The full key is shown{" "}
              <strong>once</strong>.
            </li>
            <li>
              Give the agent the key as <code>API_KEY</code> and the prompt further down this
              page as its instructions.
            </li>
            <li>Let it work. Anything it publishes is live within seconds.</li>
            <li>
              <strong>Revoke the key when the session ends.</strong> Revocation is immediate.
              Keys are stored hashed, cannot mint or revoke keys, and skip the TOTP gate, so
              an unrevoked key is the only lasting risk.
            </li>
          </ol>
        </Typography>
      </Alert>

      <ApiKeysList />

      <Box component="section" sx={{ mt: 6 }}>
        <Stack
          direction="row"
          sx={{ mb: 2, alignItems: "center", justifyContent: "space-between", gap: 2 }}
        >
          <Box>
            <Typography variant="h5" component="h2">
              Agent prompt
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
              Copy this into the agent&apos;s instructions. It teaches the agent the API:
              conventions, the content model, the endpoints each capability reaches, the
              workflows, and the rules. The base URL is this environment&apos;s.
            </Typography>
          </Box>
          <Tooltip title={copied ? "Copied" : "Copy prompt"}>
            <Button
              variant="outlined"
              onClick={() => void handleCopy()}
              startIcon={copied ? <CheckIcon color="success" /> : <ContentCopyIcon />}
              data-testid="copy-prompt-button"
            >
              {copied ? "Copied" : "Copy prompt"}
            </Button>
          </Tooltip>
        </Stack>

        <Paper
          variant="outlined"
          sx={{
            p: 2,
            maxHeight: 480,
            overflow: "auto",
            fontFamily: "monospace",
            fontSize: "0.8125rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            bgcolor: (theme) => (theme.palette.mode === "dark" ? "grey.900" : "grey.50"),
          }}
          data-testid="agent-prompt-block"
          role="region"
          aria-label="Agent prompt"
          tabIndex={0}
        >
          {prompt}
        </Paper>
      </Box>
    </Box>
  );
}
