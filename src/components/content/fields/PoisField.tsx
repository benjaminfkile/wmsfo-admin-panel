import type { FieldProps } from "@rjsf/utils";
import PoisEditor from "./PoisEditor";

function uiString(node: unknown, key: string): string | undefined {
  if (node === null || typeof node !== "object") return undefined;
  const v = (node as Record<string, unknown>)[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

// The route_preview `pois` object through PoisEditor; Default removes
// the key.
export default function PoisField(props: FieldProps) {
  return (
    <PoisEditor
      value={props.formData}
      onChange={(next) => props.onChange(next, props.fieldPathId.path)}
      title={uiString(props.uiSchema, "ui:title") ?? "Points of interest"}
      help={uiString(props.uiSchema, "ui:description")}
      disabled={Boolean(props.disabled || props.readonly)}
    />
  );
}
