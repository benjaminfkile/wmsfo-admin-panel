import type { FieldProps } from "@rjsf/utils";
import LandmarksEditor from "./LandmarksEditor";
import { landmarksValue, toLandmarks } from "../landmarks";

function uiString(node: unknown, key: string): string | undefined {
  if (node === null || typeof node !== "object") return undefined;
  const v = (node as Record<string, unknown>)[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

// The route_preview `landmarks` list through LandmarksEditor. An empty
// list removes the key.
export default function LandmarksField(props: FieldProps) {
  return (
    <LandmarksEditor
      value={toLandmarks(props.formData)}
      onChange={(next) => props.onChange(landmarksValue(next), props.fieldPathId.path)}
      title={uiString(props.uiSchema, "ui:title") ?? "Landmarks"}
      help={uiString(props.uiSchema, "ui:description")}
      disabled={Boolean(props.disabled || props.readonly)}
    />
  );
}
