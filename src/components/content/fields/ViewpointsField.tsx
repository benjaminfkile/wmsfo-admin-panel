import type { FieldProps } from "@rjsf/utils";
import { viewpointsValue, toViewpoints } from "../viewpoints";
import ViewpointsEditor from "./ViewpointsEditor";

function uiString(node: unknown, key: string): string | undefined {
  if (node === null || typeof node !== "object") return undefined;
  const v = (node as Record<string, unknown>)[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

// An array of the `Landmark` primitive (Site settings `landmarks`, shown as Viewpoints),
// edited through ViewpointsEditor. The title and help come from the
// uiSchema (the labels table). An empty list writes undefined, so the
// key is absent from the saved document.
export default function ViewpointsField(props: FieldProps) {
  const ui = props.uiSchema;
  return (
    <ViewpointsEditor
      value={toViewpoints(props.formData)}
      onChange={(next) => props.onChange(viewpointsValue(next), props.fieldPathId.path)}
      title={uiString(ui, "ui:title") ?? "Viewpoints"}
      help={uiString(ui, "ui:description")}
      disabled={props.disabled || props.readonly}
    />
  );
}
