// Inline the primitives schema into a section (or item, or site
// settings) schema so it can be handed to @rjsf/mui without an external
// resolver. External `$ref` URLs pointing at primitives are rewritten to
// local `#/$defs/...` and the primitives `$defs` are merged in.

import primitives from "../../contracts/schema/primitives.schema.json";

const PRIMITIVES_URL = "https://wmsfo.dev/schema/primitives.schema.json";

type JsonSchema = Record<string, unknown>;

function rewrite(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(rewrite);
  if (node === null || typeof node !== "object") return node;
  const obj = node as JsonSchema;
  const out: JsonSchema = {};
  for (const [k, v] of Object.entries(obj)) {
    // Strip the source `$schema` meta-URI and the per-file `$id`. rjsf
    // hands the schema to ajv 8, which does not ship the Draft-2020-12
    // meta-schema and complains on the URI. The vendored schemas are
    // valid Draft-07-compatible for validation purposes.
    if (k === "$schema" || k === "$id") continue;
    if (k === "$ref" && typeof v === "string" && v.startsWith(PRIMITIVES_URL)) {
      out[k] = v.slice(PRIMITIVES_URL.length) || "#";
    } else {
      out[k] = rewrite(v);
    }
  }
  return out;
}

export function bundleSchema<T extends JsonSchema>(schema: T): T {
  const rewritten = rewrite(schema) as JsonSchema;
  const primDefs =
    (primitives as { $defs?: Record<string, unknown> }).$defs ?? {};
  const existingDefs =
    typeof rewritten.$defs === "object" && rewritten.$defs !== null
      ? (rewritten.$defs as Record<string, unknown>)
      : {};
  return {
    ...rewritten,
    $defs: { ...primDefs, ...existingDefs },
  } as unknown as T;
}
