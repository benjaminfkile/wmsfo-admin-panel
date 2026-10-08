import { createElement, type ReactNode } from "react";
import { List, ListItem, ListItemText, Typography } from "@mui/material";

export type BodyBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "bullets"; items: string[] };

// Help bodies are plain text: blank lines separate paragraphs, and a run
// of lines starting with "- " is a bullet list. Nothing else is markup.
export function parseBody(body: string | null | undefined): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  const chunks = (body ?? "").replace(/\r\n/g, "\n").split(/\n[ \t]*\n/);
  for (const chunk of chunks) {
    let text: string[] = [];
    let items: string[] = [];
    const flushText = () => {
      if (text.length > 0) blocks.push({ kind: "paragraph", text: text.join(" ") });
      text = [];
    };
    const flushItems = () => {
      if (items.length > 0) blocks.push({ kind: "bullets", items });
      items = [];
    };
    for (const raw of chunk.split("\n")) {
      const line = raw.trim();
      if (line.length === 0) continue;
      if (line.startsWith("- ")) {
        flushText();
        items.push(line.slice(2).trim());
      } else {
        flushItems();
        text.push(line);
      }
    }
    flushText();
    flushItems();
  }
  return blocks;
}

export function renderBody(body: string | null | undefined): ReactNode {
  return parseBody(body).map((b, i) =>
    b.kind === "paragraph"
      ? createElement(
          Typography,
          { key: i, variant: "body2", sx: { mb: 1 } },
          b.text
        )
      : createElement(
          List,
          { key: i, dense: true, disablePadding: true, sx: { mb: 1, listStyleType: "disc", pl: 2.5 } },
          b.items.map((item, j) =>
            createElement(
              ListItem,
              { key: j, disablePadding: true, sx: { display: "list-item" } },
              createElement(ListItemText, {
                primary: item,
                slotProps: { primary: { variant: "body2" } },
              })
            )
          )
        )
  );
}
