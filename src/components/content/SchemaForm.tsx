import type { ReactElement } from "react";
import { useMemo } from "react";
import Form from "@rjsf/mui";
import { getDefaultRegistry } from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type { ErrorSchema, RJSFSchema, UiSchema } from "@rjsf/utils";
import type { FieldProps, RegistryFieldsType } from "@rjsf/utils";
import { RJSF_REF_KEY } from "@rjsf/utils";
import { deriveDraftSchema } from "../../schemas/draft";
import { bundleSchema } from "../../schemas/bundle";
import IconField from "./fields/IconField";
import MediaField from "./fields/MediaField";
import LinkField from "./fields/LinkField";
import InlineField from "./fields/InlineField";
import BlocksField from "./fields/BlocksField";
import PresentationPanelField from "./fields/PresentationPanelField";
import OptionalField, { extractOptional } from "./fields/OptionalField";
import ThemeField from "./fields/ThemeField";
import { labelsFor, type FieldLabels } from "./labels";

// The `$ref` values we route to custom fields. Matches the local
// definitions bundled by `bundleSchema`.
const PRIMITIVE_BY_REF: Record<string, keyof typeof CUSTOM_FIELD> = {
  "#/$defs/Icon": "IconField",
  "#/$defs/IconNullable": "IconField",
  "#/$defs/MediaRef": "MediaField",
  "#/$defs/Link": "LinkField",
  "#/$defs/Inline": "InlineField",
  "#/$defs/InlineNullable": "InlineField",
  "#/$defs/Presentation": "PresentationPanelField",
};

const CUSTOM_FIELD = {
  IconField,
  MediaField,
  LinkField,
  InlineField,
  BlocksField,
  PresentationPanelField,
  OptionalField,
  ThemeField,
};

function routedField(schema: unknown): keyof typeof CUSTOM_FIELD | null {
  if (schema === null || typeof schema !== "object") return null;
  const ref = (schema as Record<PropertyKey, unknown>)[
    RJSF_REF_KEY
  ];
  if (typeof ref === "string" && ref in PRIMITIVE_BY_REF) {
    return PRIMITIVE_BY_REF[ref] ?? null;
  }
  // Detect Block arrays: an array whose items are the `Block` primitive.
  if (
    (schema as { type?: unknown }).type === "array" &&
    typeof (schema as { items?: unknown }).items === "object" &&
    (schema as { items?: unknown }).items !== null
  ) {
    const items = (schema as { items?: Record<PropertyKey, unknown> }).items;
    const itemsRef = items?.[RJSF_REF_KEY];
    if (itemsRef === "#/$defs/Block") return "BlocksField";
  }
  // A two-branch `oneOf` where one branch is `{ type: "null" }` and the
  // other is a routed primitive `$ref` renders as an on/off switch.
  if (extractOptional(schema)) return "OptionalField";
  return null;
}

const defaultRegistry = getDefaultRegistry();
const DefaultSchemaField = defaultRegistry.fields.SchemaField as unknown as (
  props: FieldProps
) => ReactElement;

// SchemaField dispatches to a custom field when the resolved schema
// originated at one of the primitive `$ref` paths (admin.md 6.14 table).
function RoutedSchemaField(props: FieldProps) {
  const routed = routedField(props.schema);
  if (routed) {
    const Comp = CUSTOM_FIELD[routed];
    return <Comp {...props} />;
  }
  return <DefaultSchemaField {...props} />;
}

// UiSchema-based custom fields (used by SiteSettings for the theme
// object; RJSF resolves these via `ui:field: "<name>"`).
const FIELDS: RegistryFieldsType = {
  SchemaField: RoutedSchemaField,
  ThemeField,
};

interface Props<T> {
  schema: RJSFSchema;
  // A caller-provided uiSchema is merged over the one built from the
  // kind's `labels.ts` entries. Used by SiteSettings to route the
  // `theme` object to `ThemeField`.
  uiSchema?: UiSchema;
  formData: T;
  onChange: (data: T) => void;
  onBlur?: () => void;
  disabled?: boolean;
  liveValidate?: boolean;
  readonly?: boolean;
  extraErrors?: ErrorSchema;
  // The Form's default is to render its own submit button; hide when the
  // caller owns save state (the page editor autosaves).
  hideSubmit?: boolean;
  // The section kind (or item kind) whose labels drive the uiSchema.
  // Omit for schemas that are not one of the vendored section or item
  // schemas (SiteSettings passes its own labels through uiSchema).
  kind?: string;
  // `true` when the schema is a kind's `itemSchema` (rendered by
  // `ItemsEditor`); labels come from the item table in that case.
  isItem?: boolean;
}

function assignPath(
  target: Record<string, unknown>,
  path: string,
  entry: Record<string, unknown>
): void {
  const parts = path.split(".");
  let node = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i] as string;
    const next = node[key];
    if (next === undefined || next === null || typeof next !== "object") {
      const created: Record<string, unknown> = {};
      node[key] = created;
      node = created;
    } else {
      node = next as Record<string, unknown>;
    }
  }
  const last = parts[parts.length - 1] as string;
  const existing = node[last];
  if (existing && typeof existing === "object") {
    node[last] = { ...(existing as Record<string, unknown>), ...entry };
  } else {
    node[last] = entry;
  }
}

// Builds a uiSchema from the labels table for the given kind. Adds
// `ui:title`, `ui:description`, and `ui:enumNames` per entry, and
// hides the root form's own title so the schema title (e.g. "hero
// section data") never appears.
function buildUiSchemaFromLabels(
  labels: FieldLabels,
  extra?: UiSchema
): UiSchema {
  const out: Record<string, unknown> = { "ui:title": "" };
  for (const [path, entry] of Object.entries(labels)) {
    const patch: Record<string, unknown> = { "ui:title": entry.label };
    if (entry.help !== undefined) {
      patch["ui:description"] = entry.help;
    }
    if (entry.options !== undefined) {
      patch["ui:enumNames"] = entry.options;
      patch["ui:options"] = { enumNames: entry.options };
    }
    assignPath(out, path, patch);
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      const existing = out[k];
      if (
        existing &&
        typeof existing === "object" &&
        !Array.isArray(existing) &&
        v &&
        typeof v === "object" &&
        !Array.isArray(v)
      ) {
        out[k] = { ...(existing as Record<string, unknown>), ...(v as Record<string, unknown>) };
      } else {
        out[k] = v;
      }
    }
  }
  return out as UiSchema;
}

// A thin wrapper over `@rjsf/mui` that (a) inlines the primitives and
// derives the draft-level schema (admin.md 6.14, 9.1), (b) routes the
// six primitive `$ref` paths to the panel's custom fields, and (c)
// builds a uiSchema from the kind's `labels.ts` entries so every
// field shows a plain-English label, non-obvious fields carry help
// text, and enum values display their names.
export default function SchemaForm<T>({
  schema,
  uiSchema,
  formData,
  onChange,
  onBlur,
  disabled,
  liveValidate = true,
  readonly,
  extraErrors,
  hideSubmit = true,
  kind,
  isItem = false,
}: Props<T>) {
  const prepared = useMemo(() => {
    return deriveDraftSchema(bundleSchema(schema));
  }, [schema]);
  const composedUi = useMemo(() => {
    const labels = kind ? labelsFor(kind, isItem) : {};
    return buildUiSchemaFromLabels(labels, uiSchema);
  }, [kind, isItem, uiSchema]);
  return (
    <Form
      schema={prepared as RJSFSchema}
      uiSchema={composedUi}
      formData={formData}
      validator={validator}
      fields={FIELDS}
      onChange={(e) => onChange(e.formData as T)}
      onBlur={onBlur ? () => onBlur() : undefined}
      liveValidate={liveValidate}
      disabled={disabled}
      readonly={readonly}
      extraErrors={extraErrors}
      showErrorList={false}
    >
      {hideSubmit ? <span /> : undefined}
    </Form>
  );
}
