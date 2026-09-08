import { Alert, AlertTitle, Box, Typography } from "@mui/material";
import { toCopy, type MessageContext } from "../lib/errorMessages";

interface Props {
  error: unknown;
  context?: MessageContext;
  // Field names that are already surfaced on inputs; the alert lists
  // the remaining entries in details.fields.
  handledFields?: string[];
  title?: string;
}

export default function ErrorAlert({
  error,
  context,
  handledFields,
  title,
}: Props) {
  const copy = toCopy(error, context);
  const handled = new Set(handledFields ?? []);
  const unhandled = Object.entries(copy.fields).filter(
    ([k]) => !handled.has(k)
  );
  return (
    <Alert severity="error" role="alert">
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      <Typography variant="body2">{copy.message}</Typography>
      {unhandled.length > 0 ? (
        <Box component="ul" sx={{ m: 0, mt: 1, pl: 3 }}>
          {unhandled.map(([field, message]) => (
            <li key={field}>
              <Typography variant="body2">
                {field}: {message}
              </Typography>
            </li>
          ))}
        </Box>
      ) : null}
      {copy.requestId ? (
        <Typography
          variant="caption"
          sx={{ display: "block", mt: 1, fontFamily: "monospace" }}
        >
          Request {copy.requestId}
        </Typography>
      ) : null}
    </Alert>
  );
}
