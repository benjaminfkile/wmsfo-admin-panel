import { useMemo } from "react";
import {
  Box,
  FormControlLabel,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import type { FieldProps } from "@rjsf/utils";
import { RJSF_REF_KEY } from "@rjsf/utils";
import IconField from "./IconField";
import MediaField from "./MediaField";
import LinkField from "./LinkField";
import InlineField from "./InlineField";
import PresentationPanelField from "./PresentationPanelField";

type Empty = null | Record<string, unknown> | string;

interface PrimitiveEntry {
  Comp: (props: FieldProps) => React.ReactElement | null;
  empty: Empty;
}

const PRIMITIVE_BY_REF: Record<string, PrimitiveEntry> = {
  "#/$defs/Icon": { Comp: IconField, empty: null },
  "#/$defs/IconNullable": { Comp: IconField, empty: null },
  "#/$defs/MediaRef": {
    Comp: MediaField,
    empty: { mediaId: "", alt: null },
  },
  "#/$defs/Link": {
    Comp: LinkField,
    empty: { label: "", href: "", icon: null, newTab: false },
  },
  "#/$defs/Inline": { Comp: InlineField, empty: "" },
  "#/$defs/InlineNullable": { Comp: InlineField, empty: "" },
  "#/$defs/Presentation": {
    Comp: PresentationPanelField,
    empty: {
      width: "wide",
      align: "start",
      background: { kind: "none" },
      spacing: "normal",
      iconBefore: null,
      iconAfter: null,
      anchor: null,
    },
  },
};

function isNullBranch(node: unknown): boolean {
  if (node === null || typeof node !== "object") return false;
  return (node as { type?: unknown }).type === "null";
}

function primitiveRefOf(node: unknown): string | null {
  if (node === null || typeof node !== "object") return null;
  const ref = (node as Record<PropertyKey, unknown>)[RJSF_REF_KEY];
  if (typeof ref === "string" && ref in PRIMITIVE_BY_REF) return ref;
  return null;
}

interface Extracted {
  ref: string;
  branch: Record<string, unknown>;
}

export function extractOptional(schema: unknown): Extracted | null {
  if (schema === null || typeof schema !== "object") return null;
  const oneOf = (schema as { oneOf?: unknown }).oneOf;
  if (!Array.isArray(oneOf) || oneOf.length !== 2) return null;
  const [a, b] = oneOf as [unknown, unknown];
  if (isNullBranch(a) && primitiveRefOf(b)) {
    return { ref: primitiveRefOf(b) as string, branch: b as Record<string, unknown> };
  }
  if (isNullBranch(b) && primitiveRefOf(a)) {
    return { ref: primitiveRefOf(a) as string, branch: a as Record<string, unknown> };
  }
  return null;
}

function titleCase(text: string): string {
  if (text.length === 0) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// A `oneOf` of a routed primitive `$ref` and `{ type: "null" }`. A
// switch labelled with the field's label; off writes null and hides the
// editor, on shows the primitive's editor at its empty value.
export default function OptionalField(props: FieldProps) {
  const optional = useMemo(() => extractOptional(props.schema), [props.schema]);
  if (!optional) return null;
  const entry = PRIMITIVE_BY_REF[optional.ref];
  if (!entry) return null;
  const { Comp, empty } = entry;

  const value = props.formData;
  const isOn = value !== null && value !== undefined;

  const uiTitle = (props.uiSchema as { "ui:title"?: unknown } | undefined)?.[
    "ui:title"
  ];
  const rawLabel =
    typeof uiTitle === "string" && uiTitle.length > 0
      ? uiTitle
      : typeof props.schema.title === "string" && props.schema.title.length > 0
        ? props.schema.title
        : typeof props.name === "string" && props.name.length > 0
          ? titleCase(props.name)
          : "Value";

  const toggle = (next: boolean) => {
    if (next === isOn) return;
    if (next) {
      props.onChange(empty as unknown, props.fieldPathId.path);
    } else {
      props.onChange(null, props.fieldPathId.path);
    }
  };

  const innerProps: FieldProps = {
    ...props,
    schema: optional.branch,
  };

  return (
    <Box sx={{ my: 1 }} data-testid="optional-field">
      <Stack spacing={1}>
        <FormControlLabel
          control={
            <Switch
              checked={isOn}
              onChange={(e) => toggle(e.target.checked)}
              inputProps={{ "aria-label": rawLabel }}
            />
          }
          label={
            <Typography variant="body2">{rawLabel}</Typography>
          }
        />
        {isOn ? <Comp {...innerProps} /> : null}
      </Stack>
    </Box>
  );
}
