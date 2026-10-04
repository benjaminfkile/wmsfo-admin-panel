import type { FieldProps } from "@rjsf/utils";
import { landmarksValue, toLandmarks } from "../landmarks";
import LandmarksEditor from "./LandmarksEditor";

function uiString(node: unknown, key: string): string | undefined {
  if (node === null || typeof node !== "object") return undefined;
  const v = (node as Record<string, unknown>)[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

// An array of the `Landmark` primitive (Site settings `landmarks`),
// edited through LandmarksEditor. The title and help come from the
// uiSchema (the labels table). An empty list writes undefined, so the
// key is absent from the saved document.
export default function LandmarksField(props: FieldProps) {
  const ui = props.uiSchema;
  return (
    <LandmarksEditor
      value={toLandmarks(props.formData)}
      onChange={(next) => props.onChange(landmarksValue(next), props.fieldPathId.path)}
      title={uiString(ui, "ui:title") ?? "Landmarks"}
      help={uiString(ui, "ui:description")}
      disabled={props.disabled || props.readonly}
    />
  );
}
