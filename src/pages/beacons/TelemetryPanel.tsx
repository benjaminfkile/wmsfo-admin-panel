import { Box, Divider, Stack, Typography } from "@mui/material";
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

type Group = "power" | "radio" | "gps" | "transport" | "process" | "identity";

const GROUP_LABEL: Record<Group, string> = {
  power: "Power",
  radio: "Radio",
  gps: "GPS",
  transport: "Transport",
  process: "Process",
  identity: "Identity",
};

// Ordered leaf definitions per group, mirroring admin.md 6.5.
type Leaf = {
  key: string;
  label: string;
  unit?: string;
  render?: (v: unknown) => string;
  flag?: BeaconFlag;
};

const GROUP_LEAVES: Record<Group, Leaf[]> = {
  power: [
    { key: "batteryPercent", label: "batteryPercent", unit: "%", flag: "battery_low" },
    { key: "charging", label: "charging" },
    { key: "batteryTempC", label: "batteryTempC", unit: "C" },
    { key: "thermalStatus", label: "thermalStatus" },
  ],
  radio: [
    { key: "networkType", label: "networkType" },
    { key: "signalDbm", label: "signalDbm", unit: "dBm" },
    { key: "signalLevel", label: "signalLevel" },
    { key: "airplaneMode", label: "airplaneMode" },
    { key: "connected", label: "connected" },
  ],
  gps: [
    { key: "provider", label: "provider" },
    { key: "satellitesUsed", label: "satellitesUsed" },
    { key: "satellitesInView", label: "satellitesInView" },
    { key: "lastFixAccuracyM", label: "lastFixAccuracyM", unit: "m" },
    { key: "lastFixAgeS", label: "lastFixAgeS", unit: "s", flag: "no_recent_fix" },
    { key: "fixesLastMinute", label: "fixesLastMinute" },
  ],
  transport: [
    { key: "socketState", label: "socketState", flag: "socket_down" },
    { key: "reconnectCount", label: "reconnectCount" },
    { key: "httpFallbackSeconds", label: "httpFallbackSeconds", unit: "s" },
    { key: "lastReceiptLatencyMs", label: "lastReceiptLatencyMs", unit: "ms" },
    { key: "sendsFailedSinceBoot", label: "sendsFailedSinceBoot" },
  ],
  process: [
    { key: "deviceUptimeS", label: "deviceUptimeS", render: renderDurationS },
    { key: "serviceUptimeS", label: "serviceUptimeS", render: renderDurationS },
    { key: "serviceRestartCount", label: "serviceRestartCount" },
    { key: "memoryPressure", label: "memoryPressure" },
    { key: "batteryOptimizationExempt", label: "batteryOptimizationExempt" },
    { key: "notificationPermission", label: "notificationPermission" },
    { key: "systemApp", label: "systemApp" },
    { key: "rootAvailable", label: "rootAvailable" },
  ],
  identity: [
    { key: "deviceModel", label: "deviceModel" },
    { key: "androidVersion", label: "androidVersion" },
    { key: "appVersion", label: "appVersion" },
    { key: "clockSkewMs", label: "clockSkewMs", unit: "ms" },
  ],
};

function renderDurationS(v: unknown): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "unknown";
  const s = Math.max(0, Math.floor(v));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

function renderLeaf(v: unknown, unit?: string, custom?: (v: unknown) => string): string {
  if (v === null || v === undefined) return "unknown";
  if (custom) return custom(v);
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number" && !Number.isFinite(v)) return "unknown";
  const s = typeof v === "string" ? v : String(v);
  return unit ? `${s} ${unit}` : s;
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

  return (
    <Stack spacing={2}>
      <Typography variant="body2">
        <Box component="span" sx={{ color: "text.secondary" }}>
          sentAt:
        </Box>{" "}
        {formatMt(sentAtIso)}{" "}
        <Box component="span" sx={{ color: "text.secondary" }}>
          ({formatAgeS(sentAge)} ago)
        </Box>
      </Typography>

      {(Object.keys(GROUP_LEAVES) as Group[]).map((group) => (
        <GroupBlock
          key={group}
          group={group}
          heartbeat={heartbeat}
          flags={flags}
          beacon={beacon}
        />
      ))}

      <Divider />
      <details>
        <summary>
          <Typography component="span" variant="subtitle2">
            Raw heartbeat
          </Typography>
        </summary>
        <Box sx={{ mt: 1 }}>
          <ThemedJsonView value={heartbeat as unknown as object} />
        </Box>
      </details>
    </Stack>
  );
}

function GroupBlock({
  group,
  heartbeat,
  flags,
  beacon,
}: {
  group: Group;
  heartbeat: Heartbeat;
  flags: Set<BeaconFlag>;
  beacon: Beacon;
}) {
  const obj = heartbeat[group] as Record<string, unknown> | null | undefined;
  const leaves = GROUP_LEAVES[group];
  const known = new Set(leaves.map((l) => l.key));

  return (
    <Box data-group={group}>
      <Typography variant="subtitle2" gutterBottom>
        {GROUP_LABEL[group]}
      </Typography>
      {obj === null || obj === undefined ? (
        <Typography variant="body2" color="text.secondary">
          unknown
        </Typography>
      ) : (
        <Stack spacing={0.5}>
          {leaves.map((leaf) =>
            renderLeafRow(leaf, obj, flags, beacon, group)
          )}
          <PermissionRow group={group} obj={obj} flags={flags} />
          <OtherKeys obj={obj} known={known} group={group} />
        </Stack>
      )}
    </Box>
  );
}

function renderLeafRow(
  leaf: Leaf,
  obj: Record<string, unknown>,
  flags: Set<BeaconFlag>,
  beacon: Beacon,
  group: Group
) {
  let coloured = false;
  if (leaf.flag && flags.has(leaf.flag)) {
    if (leaf.flag === "socket_down" && group === "transport") {
      const hub = beacon.hubConnected ?? null;
      coloured = hub === false || obj.socketState !== "connected";
    } else {
      coloured = true;
    }
  }
  const value = renderLeaf(obj[leaf.key], leaf.unit, leaf.render);
  return (
    <Typography
      key={leaf.key}
      variant="body2"
      component="div"
      color={coloured ? "error" : "text.primary"}
      data-leaf={leaf.key}
    >
      <Box component="span" sx={{ color: "text.secondary" }}>
        {leaf.label}:
      </Box>{" "}
      {value}
    </Typography>
  );
}

function PermissionRow({
  group,
  obj,
  flags,
}: {
  group: Group;
  obj: Record<string, unknown>;
  flags: Set<BeaconFlag>;
}) {
  if (group !== "gps") return null;
  const perm = obj.permission as
    | { foreground: boolean | null; background: boolean | null; precise: boolean | null }
    | null
    | undefined;
  if (perm === null || perm === undefined) {
    return (
      <Typography variant="body2" component="div" data-leaf="permission">
        <Box component="span" sx={{ color: "text.secondary" }}>
          permission:
        </Box>{" "}
        unknown
      </Typography>
    );
  }
  return (
    <Stack sx={{ pl: 2 }} spacing={0.25}>
      {(["foreground", "background", "precise"] as const).map((k) => {
        const v = perm[k];
        const coloured =
          flags.has("permission_missing") && v === false;
        return (
          <Typography
            key={k}
            variant="body2"
            component="div"
            color={coloured ? "error" : "text.primary"}
            data-leaf={`permission.${k}`}
          >
            <Box component="span" sx={{ color: "text.secondary" }}>
              permission.{k}:
            </Box>{" "}
            {v === null || v === undefined ? "unknown" : v ? "yes" : "no"}
          </Typography>
        );
      })}
    </Stack>
  );
}

function OtherKeys({
  obj,
  known,
  group,
}: {
  obj: Record<string, unknown>;
  known: Set<string>;
  group: Group;
}) {
  const skip = new Set<string>(known);
  if (group === "gps") skip.add("permission");
  const others: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!skip.has(k)) others[k] = v;
  }
  if (Object.keys(others).length === 0) return null;
  return (
    <Box sx={{ mt: 0.5 }}>
      <Typography variant="caption" color="text.secondary">
        Other
      </Typography>
      <ThemedJsonView value={others} />
    </Box>
  );
}
