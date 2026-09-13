import JsonView from "@uiw/react-json-view";
import { Box, IconButton, InputAdornment, Stack, TextField, Tooltip, useTheme } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SearchIcon from "@mui/icons-material/Search";
import { useMemo, useState, type CSSProperties } from "react";

type CssVars = CSSProperties & Record<`--${string}`, string>;

interface Props {
  value: unknown;
  // Depth at which to collapse tree nodes; nodes deeper than this are
  // collapsed on first render. Root is depth 0.
  collapsed?: number | boolean;
  // Show a Copy button that writes the JSON text to the clipboard.
  copy?: boolean;
  // Show a search input that filters top-level keys by substring.
  keySearch?: boolean;
}

function filterByKey(value: unknown, needle: string): unknown {
  if (!needle) return value;
  const q = needle.toLowerCase();
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return undefined;
    if (Array.isArray(v)) {
      const items = v
        .map(walk)
        .filter((x) => x !== undefined);
      return items.length > 0 ? items : undefined;
    }
    const out: Record<string, unknown> = {};
    for (const [k, sub] of Object.entries(v as Record<string, unknown>)) {
      if (k.toLowerCase().includes(q)) {
        out[k] = sub;
      } else if (sub !== null && typeof sub === "object") {
        const s = walk(sub);
        if (s !== undefined) out[k] = s;
      }
    }
    return Object.keys(out).length > 0 ? out : undefined;
  };
  const result = walk(value);
  return result ?? {};
}

export function ThemedJsonView({
  value,
  collapsed,
  copy = false,
  keySearch = false,
}: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(
    () => (keySearch ? filterByKey(value, q) : value),
    [value, q, keySearch]
  );

  if (!filtered || typeof filtered !== "object") return null;

  const vars: CssVars = {
    "--w-rjv-background-color": "transparent",
    "--w-rjv-color": isDark ? "#e5e7eb" : "#111827",
    "--w-rjv-key-string": isDark ? "#93c5fd" : "#1d4ed8",
    "--w-rjv-string": isDark ? "#86efac" : "#065f46",
    "--w-rjv-number": isDark ? "#fbbf24" : "#92400e",
    "--w-rjv-boolean": isDark ? "#67e8f9" : "#155e75",
    "--w-rjv-null": isDark ? "#9ca3af" : "#6b7280",
    "--w-rjv-brackets": isDark ? "#c7d2fe" : "#374151",
    "--w-rjv-colon": isDark ? "#c7d2fe" : "#374151",
    "--w-rjv-caret-color": isDark ? "#e5e7eb" : "#111827",
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard may be unavailable; ignore
    }
  };

  return (
    <Stack spacing={1}>
      {(copy || keySearch) && (
        <Stack direction="row" spacing={1} alignItems="center">
          {keySearch ? (
            <TextField
              size="small"
              value={q}
              placeholder="Search keys"
              onChange={(e) => setQ(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1, maxWidth: 320 }}
            />
          ) : (
            <Box sx={{ flexGrow: 1 }} />
          )}
          {copy ? (
            <Tooltip title={copied ? "Copied" : "Copy JSON"}>
              <IconButton size="small" onClick={onCopy} aria-label="Copy JSON">
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : null}
        </Stack>
      )}
      <Box
        sx={{
          p: 1.5,
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
          fontSize: 13,
          fontFamily: "Menlo, Monaco, Consolas, monospace",
          ...vars,
        }}
      >
        <JsonView
          value={filtered as Record<string, unknown>}
          displayDataTypes={false}
          enableClipboard={false}
          collapsed={collapsed}
          style={{ background: "transparent" }}
        />
      </Box>
    </Stack>
  );
}
