import type { ReactElement } from "react";
import { useMemo } from "react";
import Form from "@rjsf/mui";
import { getDefaultRegistry } from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type { RJSFSchema, UiSchema } from "@rjsf/utils";
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

const FIELDS: RegistryFieldsType = {
  SchemaField: RoutedSchemaField,
};

interface Props<T> {
  schema: RJSFSchema;
  uiSchema?: UiSchema;
  formData: T;
  onChange: (data: T) => void;
  onBlur?: () => void;
  disabled?: boolean;
  liveValidate?: boolean;
  readonly?: boolean;
  // The Form's default is to render its own submit button; hide when the
  // caller owns save state (the page editor autosaves).
  hideSubmit?: boolean;
}

// A thin wrapper over `@rjsf/mui` that (a) inlines the primitives and
// derives the draft-level schema (admin.md 6.14, 9.1) and (b) routes the
// six primitive `$ref` paths to the panel's custom fields.
export default function SchemaForm<T>({
  schema,
  uiSchema,
  formData,
  onChange,
  onBlur,
  disabled,
  liveValidate = true,
  readonly,
  hideSubmit = true,
}: Props<T>) {
  const prepared = useMemo(() => {
    return deriveDraftSchema(bundleSchema(schema));
  }, [schema]);
  return (
    <Form
      schema={prepared as RJSFSchema}
      uiSchema={uiSchema}
      formData={formData}
      validator={validator}
      fields={FIELDS}
      onChange={(e) => onChange(e.formData as T)}
      onBlur={onBlur ? () => onBlur() : undefined}
      liveValidate={liveValidate}
      disabled={disabled}
      readonly={readonly}
      showErrorList={false}
    >
      {hideSubmit ? <span /> : undefined}
    </Form>
  );
}
