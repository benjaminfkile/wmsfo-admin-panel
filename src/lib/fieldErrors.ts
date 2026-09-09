import type { ErrorSchema } from "@rjsf/utils";

function decodePointerSegment(seg: string): string {
  return seg.replace(/~1/g, "/").replace(/~0/g, "~");
}

// Convert a `details.fields` map (JSON pointer -> message) into the
// recursive `ErrorSchema` shape RJSF expects on its `extraErrors` prop.
// A root pointer ("") is dropped; per-array-index segments become
// numeric keys, matching RJSF's convention for arrays.
export function fieldsToErrorSchema(
  fields: Record<string, string>
): ErrorSchema {
  const root: Record<string, unknown> = {};
  for (const [ptr, msg] of Object.entries(fields)) {
    if (typeof msg !== "string" || msg === "") continue;
    if (!ptr.startsWith("/")) continue;
    const rest = ptr.slice(1);
    if (rest === "") continue;
    const parts = rest.split("/").map(decodePointerSegment);
    let cur: Record<string, unknown> = root;
    for (let i = 0; i < parts.length; i += 1) {
      const key = parts[i] ?? "";
      if (i === parts.length - 1) {
        const node = (cur[key] ??= {}) as Record<string, unknown>;
        const errs = (node.__errors ??= []) as string[];
        errs.push(msg);
      } else {
        const node = (cur[key] ??= {}) as Record<string, unknown>;
        cur = node;
      }
    }
  }
  return root as ErrorSchema;
}
