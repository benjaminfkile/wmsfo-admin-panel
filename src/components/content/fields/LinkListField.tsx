import { Box, Typography } from "@mui/material";
import type { FieldProps } from "@rjsf/utils";
import LinkList from "../blocks/LinkList";
import { toLinks } from "../blocks/linkValues";
import type { LinkPartLabels, LinkValue } from "../blocks/LinkControl";

type UiNode = Record<string, unknown>;

function uiString(node: unknown, key: string): string | undefined {
  if (node === null || typeof node !== "object") return undefined;
  const v = (node as UiNode)[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function childNode(node: unknown, key: string): unknown {
  return node !== null && typeof node === "object"
    ? (node as UiNode)[key]
    : undefined;
}

// An array whose items are the `Link` primitive. The field's label and
// help come from the uiSchema (the labels table); the entries render
// through the shared LinkList with the schema's `minItems` and
// `maxItems` as its bounds. Each entry is titled by the items'
// `ui:title` ("Link" by default) and its parts by their own
// `ui:title`s under `items`.
export default function LinkListField(props: FieldProps) {
  const links = toLinks(props.formData);
  const ui = props.uiSchema;
  const items = childNode(ui, "items");

  const title =
    uiString(ui, "ui:title") ??
    (typeof props.schema.title === "string" ? props.schema.title : props.name);
  const help = uiString(ui, "ui:description");

  const min =
    typeof props.schema.minItems === "number" ? props.schema.minItems : 0;
  const max =
    typeof props.schema.maxItems === "number"
      ? props.schema.maxItems
      : Number.POSITIVE_INFINITY;

  const partLabels: LinkPartLabels = {};
  for (const part of ["label", "href", "icon", "newTab"] as const) {
    const t = uiString(childNode(items, part), "ui:title");
    if (t) partLabels[part] = t;
  }

  const setLinks = (next: LinkValue[]) => {
    props.onChange(next as unknown, props.fieldPathId.path);
  };

  return (
    <Box sx={{ my: 1, minWidth: 0 }} data-testid="link-list-field">
      <Typography variant="subtitle2">{title}</Typography>
      {help ? (
        <Typography variant="caption" color="text.secondary" component="p">
          {help}
        </Typography>
      ) : null}
      <Box sx={{ mt: 1 }}>
        <LinkList
          links={links}
          onChange={setLinks}
          min={min}
          max={max}
          itemLabel={uiString(items, "ui:title") ?? "Link"}
          partLabels={partLabels}
          testIdPrefix="link-list"
        />
      </Box>
    </Box>
  );
}
