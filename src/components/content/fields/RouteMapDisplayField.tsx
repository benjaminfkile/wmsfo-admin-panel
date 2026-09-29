import type { FieldProps } from "@rjsf/utils";
import { useQuery } from "@tanstack/react-query";
import { siteSettings as siteSettingsApi } from "../../../api/resources/siteSettings";
import { keys } from "../../../queries/keys";
import RouteMapDisplayControls from "./RouteMapDisplayControls";

function uiString(node: unknown, key: string): string | undefined {
  if (node === null || typeof node !== "object") return undefined;
  const v = (node as Record<string, unknown>)[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

type GroupProps = FieldProps & {
  // Sitewide: each control shows the built-in default while unset.
  // Override: each control shows "Site default (<value>)" while unset,
  // with the value resolved from `inherited`, and a Clear once set.
  mode: "sitewide" | "override";
  inherited: unknown;
  testId: string;
};

function RouteMapGroup(props: GroupProps) {
  return (
    <RouteMapDisplayControls
      value={props.formData}
      onChange={(next) => props.onChange(next as unknown, props.fieldPathId.path)}
      mode={props.mode}
      inherited={props.inherited}
      testId={props.testId}
      title={uiString(props.uiSchema, "ui:title") ?? "Route map"}
      help={uiString(props.uiSchema, "ui:description")}
      disabled={Boolean(props.disabled || props.readonly)}
    />
  );
}

// The site settings `routeMap` block: Time labels, Arrow size, and
// Route line selects and an Arrows switch, each showing the built-in
// default while unset and writing only a picked value.
export default function RouteMapDisplayField(props: FieldProps) {
  return (
    <RouteMapGroup
      {...props}
      mode="sitewide"
      inherited={undefined}
      testId="route-map-sitewide"
    />
  );
}

// The route_preview `display` object: the same four knobs as selects
// that show "Site default (<value>)" while unset, the value read from
// the site settings draft's `routeMap` (else the built-in default). A
// pick writes the override; Clear removes the key so it inherits again,
// and removing the last key removes `display`.
export function RouteMapOverrideField(props: FieldProps) {
  const settingsQ = useQuery({
    queryKey: keys.siteSettings,
    queryFn: () => siteSettingsApi.get(),
  });
  const sitewide = (settingsQ.data?.data as Record<string, unknown> | undefined)?.routeMap;
  return (
    <RouteMapGroup
      {...props}
      mode="override"
      inherited={sitewide}
      testId="route-map-override"
    />
  );
}
