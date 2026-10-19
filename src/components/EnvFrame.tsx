import { Box, useTheme } from "@mui/material";
import type { AppEnv } from "../config";
import { useConfig } from "../ConfigContext";

const PALETTE_KEY: Record<AppEnv, "error" | "success" | "info"> = {
  prod: "error",
  dev: "success",
  local: "info",
};

export default function EnvFrame() {
  const config = useConfig();
  const theme = useTheme();
  const colour = theme.palette[PALETTE_KEY[config.env]].main;
  return (
    <Box
      aria-hidden
      data-testid="env-frame"
      data-env={config.env}
      sx={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: theme.zIndex.tooltip + 1,
        boxShadow: `inset 0 0 0 3px ${colour}`,
      }}
    />
  );
}
