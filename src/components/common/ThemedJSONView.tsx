import JsonView from "@uiw/react-json-view";
import { Box, useTheme } from "@mui/material";

export function ThemedJsonView({ value }: { value: unknown }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  if (!value || typeof value !== "object") return null;

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        fontSize: 13,
        fontFamily: "Menlo, Monaco, Consolas, monospace",

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
      } as any} 
    >
      <JsonView
        value={value as Record<string, unknown>}
        displayDataTypes={false}
        enableClipboard={false}
        style={{ background: "transparent" }}
      />
    </Box>
  );
}
