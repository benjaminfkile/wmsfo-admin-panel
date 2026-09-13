import { Box, Stack, Typography } from "@mui/material";
import type { Beacon, Heartbeat } from "../../api/types";
import { ageS, formatAgeS, formatMt } from "../../lib/time";
import { beaconFlags, type BeaconFlag } from "../../lib/beaconFlags";
import { ThemedJsonView } from "../../components/ThemedJsonView";

interface Props {
  beacon: Beacon;
  staleAfterS: number;
  anyEventLive: boolean;
  now: number;
}

function hubStateLabel(b: Beacon): string {
  if (b.hubConnected === true) return "connected";
  if (b.hubConnected === false) return "polling";
  return "unknown";
}

function renderLeaf(
  v: number | string | null | undefined,
  unit?: string
): { text: string; reported: boolean } {
  if (v === undefined) return { text: "not reported", reported: false };
  if (v === null) return { text: "unknown", reported: true };
  return { text: unit ? `${v} ${unit}` : String(v), reported: true };
}

export default function TelemetryPanel({
  beacon,
  staleAfterS,
  anyEventLive,
  now,
}: Props) {
  const heartbeat = (beacon.telemetry as Heartbeat | null | undefined) ?? null;

  if (heartbeat === null) {
    return (
      <Typography variant="body2" color="text.secondary">
        No heartbeat received
      </Typography>
    );
  }

  const flags = new Set(beaconFlags(beacon, staleAfterS, anyEventLive, now));
  const sentAtIso = heartbeat.sentAt ?? null;
  const sentAge = ageS(sentAtIso, now);
  const health = heartbeat.health ?? null;
  const debug = (heartbeat.debug ?? null) as Record<string, unknown> | null;
  const debugEmpty =
    debug === null ||
    (typeof debug === "object" && !Array.isArray(debug) && Object.keys(debug).length === 0);

  const battery = renderLeaf(
    health && "batteryPercent" in health ? health.batteryPercent : undefined,
    "%"
  );
  const fixAge = renderLeaf(
    health && "lastFixAgeS" in health ? health.lastFixAgeS : undefined,
    "s"
  );
  const socket = renderLeaf(
    health && "socketState" in health ? health.socketState : undefined
  );

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="subtitle1" gutterBottom>
          Health
        </Typography>
        <Stack spacing={0.5}>
          <Typography variant="body2" component="div">
            <Box component="span" sx={{ color: "text.secondary", mr: 1 }}>
              sentAt:
            </Box>
            {formatMt(sentAtIso)}
            <Box component="span" sx={{ color: "text.secondary", ml: 1 }}>
              ({formatAgeS(sentAge)} ago)
            </Box>
          </Typography>
          <Typography variant="body2" component="div">
            <Box component="span" sx={{ color: "text.secondary", mr: 1 }}>
              hub:
            </Box>
            {hubStateLabel(beacon)}
          </Typography>
          <HealthLeaf
            label="batteryPercent"
            value={battery.text}
            coloured={battery.reported && flagIn(flags, "battery_low")}
          />
          <HealthLeaf
            label="lastFixAgeS"
            value={fixAge.text}
            coloured={fixAge.reported && flagIn(flags, "no_recent_fix")}
          />
          <HealthLeaf
            label="socketState"
            value={socket.text}
            coloured={socket.reported && flagIn(flags, "socket_down")}
          />
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle1" gutterBottom>
          Debug
        </Typography>
        {debugEmpty ? (
          <Typography variant="body2" color="text.secondary">
            This beacon sends no debug data
          </Typography>
        ) : (
          <ThemedJsonView value={debug} collapsed={2} copy keySearch />
        )}
      </Box>
    </Stack>
  );
}

function flagIn(flags: Set<BeaconFlag>, flag: BeaconFlag): boolean {
  return flags.has(flag);
}

function HealthLeaf({
  label,
  value,
  coloured,
}: {
  label: string;
  value: string;
  coloured: boolean;
}) {
  return (
    <Typography
      variant="body2"
      component="div"
      color={coloured ? "error" : "text.primary"}
      data-leaf={label}
    >
      <Box component="span" sx={{ color: "text.secondary", mr: 1 }}>
        {label}:
      </Box>
      {value}
    </Typography>
  );
}
