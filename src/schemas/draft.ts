// Derive the draft-level schema from a publish schema (admin.md 6.14,
// 9.1). At draft time incompleteness is a problem, not an error, so
// every constraint that fires on "not filled in yet" is stripped: the
// `required` list at every object level, `minLength` on any string,
// `minItems` on any array, and `minimum` on any number. Every other
// keyword (`type`, `maxLength`, `pattern`, `enum`, `additionalProperties`,
// `$ref`, `oneOf`, `anyOf`, `allOf`, `maximum`, `maxItems`, `exclusiveMinimum`,
// etc.) is preserved so shape errors still surface immediately.

type JsonSchema = Record<string, unknown>;

const KEYS_WITH_SCHEMA_MAP: readonly string[] = [
  "properties",
  "patternProperties",
  "$defs",
  "definitions",
  "dependentSchemas",
];

const KEYS_WITH_SCHEMA_LIST: readonly string[] = ["oneOf", "anyOf", "allOf"];

const KEYS_WITH_SINGLE_SCHEMA: readonly string[] = [
  "items",
  "additionalProperties",
  "additionalItems",
  "propertyNames",
  "contains",
  "not",
  "if",
  "then",
  "else",
];

function derive(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(derive);
  if (node === null || typeof node !== "object") return node;
  const obj = node as JsonSchema;
  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(obj)) {
    if (
      key === "required" ||
      key === "minLength" ||
      key === "minItems" ||
      key === "minimum"
    ) {
      continue;
    }
    if (KEYS_WITH_SCHEMA_MAP.includes(key)) {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        const mapped: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          mapped[k] = derive(v);
        }
        out[key] = mapped;
      } else {
        out[key] = value;
      }
      continue;
    }
    if (KEYS_WITH_SCHEMA_LIST.includes(key)) {
      if (Array.isArray(value)) {
        out[key] = value.map(derive);
      } else {
        out[key] = value;
      }
      continue;
    }
    if (KEYS_WITH_SINGLE_SCHEMA.includes(key)) {
      // `items` may be a single schema or an array (draft-04 tuple form).
      out[key] = Array.isArray(value) ? value.map(derive) : derive(value);
      continue;
    }
    out[key] = value;
  }
  return out;
}

export function deriveDraftSchema<T extends JsonSchema>(schema: T): T {
  return derive(schema) as T;
}
