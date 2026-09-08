import { Chip, Tooltip } from "@mui/material";
import type { AppEnv } from "../config";
import { useConfig } from "../ConfigContext";

const COLOR: Record<AppEnv, "error" | "success" | "info"> = {
  prod: "error",
  dev: "success",
  local: "info",
};

export default function EnvBadge() {
  const config = useConfig();
  return (
    <Tooltip title={config.apiBaseUrl}>
      <Chip
        label={config.env.toUpperCase()}
        color={COLOR[config.env]}
        size="small"
        sx={{ fontWeight: 700, letterSpacing: "0.5px" }}
      />
    </Tooltip>
  );
}
