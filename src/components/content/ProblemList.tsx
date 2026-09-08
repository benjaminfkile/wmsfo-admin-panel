import { Alert, List, ListItem, ListItemText } from "@mui/material";
import type { Problem } from "../../api/types";

interface Props {
  problems: Problem[];
  emptyText?: string;
}

// Renders a list of `ProblemDto` entries (admin.md 6.18). Each problem
// has a `path` and a `message`.
export default function ProblemList({ problems, emptyText }: Props) {
  if (problems.length === 0) {
    return emptyText ? (
      <Alert severity="success" variant="outlined">
        {emptyText}
      </Alert>
    ) : null;
  }
  return (
    <List dense data-testid="problem-list">
      {problems.map((p, i) => (
        <ListItem key={`${p.path ?? ""}-${i}`}>
          <ListItemText primary={p.message} secondary={p.path} />
        </ListItem>
      ))}
    </List>
  );
}
