import { Fragment, type ReactNode } from "react";
import { Box } from "@mui/material";
import IconPreview from "./IconPreview";
import { formatMt } from "../../lib/time";
import type { Icon } from "../../api/types";

export type InlineEventContext = {
  name: string;
  year: number | null;
  scheduledAt: string | null;
} | null;

type Token =
  | { kind: "bold"; body: string }
  | { kind: "italic"; body: string }
  | { kind: "code"; body: string }
  | { kind: "link"; label: string; href: string }
  | { kind: "icon-library"; id: string }
  | { kind: "icon-media"; id: string }
  | { kind: "event-name" }
  | { kind: "event-year" }
  | { kind: "event-scheduledAt" }
  | { kind: "newline" };

type Match = { start: number; end: number; token: Token };

// A pipe-alternation regex whose groups let the parser pick which token
// matched, in a single scan. Bold is listed before italic so `**x**`
// resolves to bold rather than `*` + `*x*` + `*`. Link and icon and
// event placeholders each own their capture groups.
const PATTERN =
  /\*\*([\s\S]+?)\*\*|\*([\s\S]+?)\*|`([\s\S]+?)`|\[([^\]]+)\]\(([^)]+)\)|\{icon:media:([^}]+)\}|\{icon:([^}]+)\}|\{event:(name|year|scheduledAt)\}|\n/g;

function nextMatch(text: string, from: number): Match | null {
  PATTERN.lastIndex = from;
  const m = PATTERN.exec(text);
  if (!m) return null;
  const start = m.index;
  const end = start + m[0].length;
  if (m[1] !== undefined) {
    return { start, end, token: { kind: "bold", body: m[1] } };
  }
  if (m[2] !== undefined) {
    return { start, end, token: { kind: "italic", body: m[2] } };
  }
  if (m[3] !== undefined) {
    return { start, end, token: { kind: "code", body: m[3] } };
  }
  if (m[4] !== undefined && m[5] !== undefined) {
    return {
      start,
      end,
      token: { kind: "link", label: m[4], href: m[5] },
    };
  }
  if (m[6] !== undefined) {
    return { start, end, token: { kind: "icon-media", id: m[6] } };
  }
  if (m[7] !== undefined) {
    return { start, end, token: { kind: "icon-library", id: m[7] } };
  }
  if (m[8] !== undefined) {
    if (m[8] === "name") return { start, end, token: { kind: "event-name" } };
    if (m[8] === "year") return { start, end, token: { kind: "event-year" } };
    return { start, end, token: { kind: "event-scheduledAt" } };
  }
  return { start, end, token: { kind: "newline" } };
}

function renderToken(
  token: Token,
  key: number,
  event: InlineEventContext
): ReactNode {
  switch (token.kind) {
    case "bold":
      return <strong key={key}>{token.body}</strong>;
    case "italic":
      return <em key={key}>{token.body}</em>;
    case "code":
      return (
        <Box
          key={key}
          component="code"
          sx={{
            fontFamily: "monospace",
            bgcolor: "action.hover",
            borderRadius: 0.5,
            px: 0.5,
          }}
        >
          {token.body}
        </Box>
      );
    case "link":
      return (
        <Box
          key={key}
          component="span"
          sx={{ textDecoration: "underline" }}
          data-testid="inline-preview-link"
          data-href={token.href}
        >
          {token.label}
        </Box>
      );
    case "icon-library": {
      const icon: Icon = {
        source: "library",
        id: token.id,
      } as unknown as Icon;
      return (
        <Box
          key={key}
          component="span"
          sx={{ display: "inline-flex", verticalAlign: "middle", mx: 0.25 }}
        >
          <IconPreview icon={icon} size={16} />
        </Box>
      );
    }
    case "icon-media": {
      const icon: Icon = {
        source: "media",
        id: token.id,
      } as unknown as Icon;
      return (
        <Box
          key={key}
          component="span"
          sx={{ display: "inline-flex", verticalAlign: "middle", mx: 0.25 }}
        >
          <IconPreview icon={icon} size={16} />
        </Box>
      );
    }
    case "event-name":
      return event?.name ? <Fragment key={key}>{event.name}</Fragment> : null;
    case "event-year":
      return typeof event?.year === "number" ? (
        <Fragment key={key}>{event.year}</Fragment>
      ) : null;
    case "event-scheduledAt":
      return event?.scheduledAt ? (
        <Fragment key={key}>{formatMt(event.scheduledAt)}</Fragment>
      ) : null;
    case "newline":
      return <br key={key} />;
  }
}

// Parses the constrained inline markdown of contracts 1.3a and returns
// React nodes: `**bold**`, `*italic*`, `` `code` ``, `[label](href)`,
// `{icon:<id>}` or `{icon:media:<id>}`, a newline as a line break, and
// the placeholders `{event:name}`, `{event:year}`, `{event:scheduledAt}`
// resolved from `event` (blank when the event is null; `scheduledAt`
// formatted in America/Denver). Anything else is left literal. Never
// uses innerHTML.
export function renderInlinePreview(
  text: string,
  event: InlineEventContext
): ReactNode {
  const out: ReactNode[] = [];
  let cursor = 0;
  let key = 0;
  while (cursor < text.length) {
    const match = nextMatch(text, cursor);
    if (!match) {
      out.push(<Fragment key={key++}>{text.slice(cursor)}</Fragment>);
      break;
    }
    if (match.start > cursor) {
      out.push(
        <Fragment key={key++}>{text.slice(cursor, match.start)}</Fragment>
      );
    }
    out.push(renderToken(match.token, key++, event));
    cursor = match.end;
  }
  return <>{out}</>;
}
