import type { ReactElement } from "react";
import { useMemo } from "react";
import Form from "@rjsf/mui";
import { getDefaultRegistry } from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type { ErrorSchema, RJSFSchema, UiSchema } from "@rjsf/utils";
import type {
  FieldProps,
  RegistryFieldsType,
  RegistryWidgetsType,
} from "@rjsf/utils";
import { RJSF_REF_KEY } from "@rjsf/utils";
import { deriveDraftSchema } from "../../schemas/draft";
import { bundleSchema } from "../../schemas/bundle";
import IconField from "./fields/IconField";
import MediaField from "./fields/MediaField";
import LinkField from "./fields/LinkField";
import InlineField from "./fields/InlineField";
import BlocksField from "./fields/BlocksField";
import LinkListField from "./fields/LinkListField";
import PresentationPanelField from "./fields/PresentationPanelField";
import OptionalField, { extractOptional } from "./fields/OptionalField";
import ThemeField from "./fields/ThemeField";
import DefaultedSelectWidget from "./fields/DefaultedSelectWidget";
import { labelsFor, orderFor, type FieldLabels } from "./labels";

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
  LinkListField,
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
  // Detect Block and Link arrays: an array whose items are the `Block`
  // or the `Link` primitive.
  if (
    (schema as { type?: unknown }).type === "array" &&
    typeof (schema as { items?: unknown }).items === "object" &&
    (schema as { items?: unknown }).items !== null
  ) {
    const items = (schema as { items?: Record<PropertyKey, unknown> }).items;
    const itemsRef = items?.[RJSF_REF_KEY];
    if (itemsRef === "#/$defs/Block") return "BlocksField";
    if (itemsRef === "#/$defs/Link") return "LinkListField";
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

const WIDGETS: RegistryWidgetsType = { DefaultedSelectWidget };

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
  // schemas.
  kind?: string;
  // A labels table used instead of the kind's (SiteSettings passes
  // `SITE_SETTINGS`).
  labels?: FieldLabels;
  // `true` when the schema is a kind's `itemSchema` (rendered by
  // `ItemsEditor`); labels come from the item table in that case.
  isItem?: boolean;
}

type JsonNode = Record<string, unknown>;

function asNode(v: unknown): JsonNode | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as JsonNode)
    : null;
}

// Keys whose values are data, not subschemas; their contents are kept
// as they are.
const DATA_KEYWORDS = new Set(["default", "const", "enum", "examples"]);

// Removes every `description` string from a schema, the root and every
// subschema. Schema descriptions are developer notes; the help a form
// shows comes from the labels table only. A property named
// `description` is a subschema (an object), so it is kept.
function stripDescriptions(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripDescriptions);
  const obj = asNode(node);
  if (!obj) return node;
  const out: JsonNode = {};
  for (const [k, v] of Object.entries(obj)) {
    if (k === "description" && typeof v === "string") continue;
    out[k] = DATA_KEYWORDS.has(k) ? v : stripDescriptions(v);
  }
  return out;
}

// Follows a local `#/$defs/<name>` reference against the root schema.
function resolveLocal(root: JsonNode, node: JsonNode | null): JsonNode | null {
  const ref = node?.$ref;
  if (typeof ref !== "string" || !ref.startsWith("#/$defs/")) return node;
  const defs = asNode(root.$defs);
  return asNode(defs?.[ref.slice("#/$defs/".length)]);
}

// Turns a dotted labels path into uiSchema keys. A path segment that
// names an array is followed by `items`, so `footerLinks.href` becomes
// `footerLinks.items.href`, the uiSchema of every entry's `href`.
function uiPathParts(root: JsonNode, path: string): string[] {
  const parts = path.split(".");
  const out: string[] = [];
  let node: JsonNode | null = root;
  parts.forEach((part, i) => {
    out.push(part);
    node = resolveLocal(root, asNode(asNode(node?.properties)?.[part]));
    if (node?.type === "array" && i < parts.length - 1) {
      out.push("items");
      node = resolveLocal(root, asNode(node.items));
    }
  });
  return out;
}

function assignPath(
  target: JsonNode,
  parts: string[],
  entry: JsonNode
): void {
  let node = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i] as string;
    const next = asNode(node[key]);
    if (!next) {
      const created: JsonNode = {};
      node[key] = created;
      node = created;
    } else {
      node = next;
    }
  }
  const last = parts[parts.length - 1] as string;
  const existing = asNode(node[last]);
  node[last] = existing ? { ...existing, ...entry } : entry;
}

// Merges `extra` over `base` key by key, descending into objects on
// both sides.
function mergeUi(base: JsonNode, extra: JsonNode): JsonNode {
  const out: JsonNode = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    const a = asNode(out[k]);
    const b = asNode(v);
    out[k] = a && b ? mergeUi(a, b) : v;
  }
  return out;
}

// Builds a uiSchema from a labels table. Adds `ui:title`,
// `ui:description` (the entry's help), and `ui:enumNames` per entry,
// sets `ui:order` when the kind has a field order, and hides the root
// form's own title so the schema title (e.g. "hero section data") never
// appears.
function buildUiSchemaFromLabels(
  labels: FieldLabels,
  schema: JsonNode,
  extra?: UiSchema,
  order?: string[]
): UiSchema {
  const out: JsonNode = { "ui:title": "" };
  if (order) out["ui:order"] = order;
  for (const [path, entry] of Object.entries(labels)) {
    const patch: JsonNode = { "ui:title": entry.label };
    if (entry.help !== undefined) {
      patch["ui:description"] = entry.help;
    }
    if (entry.options !== undefined) {
      patch["ui:enumNames"] = entry.options;
      patch["ui:options"] = { enumNames: entry.options };
      if (entry.unset !== undefined) {
        patch["ui:widget"] = "DefaultedSelectWidget";
        patch["ui:options"] = {
          enumNames: entry.options,
          unsetLabel: entry.options[entry.unset] ?? entry.unset,
        };
      }
    }
    assignPath(out, uiPathParts(schema, path), patch);
  }
  return (extra ? mergeUi(out, extra as JsonNode) : out) as UiSchema;
}

// A thin wrapper over `@rjsf/mui` that (a) inlines the primitives,
// derives the draft-level schema (admin.md 6.14, 9.1), and removes the
// schema's own descriptions, (b) routes the
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
  labels,
}: Props<T>) {
  const prepared = useMemo(() => {
    return stripDescriptions(
      deriveDraftSchema(bundleSchema(schema))
    ) as JsonNode;
  }, [schema]);
  const composedUi = useMemo(() => {
    const table = labels ?? (kind ? labelsFor(kind, isItem) : {});
    const order = !labels && kind ? orderFor(kind, isItem) : undefined;
    return buildUiSchemaFromLabels(table, prepared, uiSchema, order);
  }, [labels, kind, isItem, prepared, uiSchema]);
  return (
    <Form
      schema={prepared as RJSFSchema}
      uiSchema={composedUi}
      formData={formData}
      validator={validator}
      fields={FIELDS}
      widgets={WIDGETS}
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
