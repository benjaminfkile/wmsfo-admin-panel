import { Alert, Box, Typography } from "@mui/material";

// Info notice under the status and notify message fields while the field
// is empty: the lead sentence saying where the API's default message goes,
// then that stock paragraph in a quoted block.
export default function DefaultMessageNotice({
  lead,
  paragraph,
}: {
  lead: string;
  paragraph: string;
}) {
  return (
    <Alert severity="info" data-testid="default-message-notice">
      <Typography variant="body2">{lead}</Typography>
      <Box
        component="blockquote"
        sx={{
          m: 0,
          mt: 1,
          pl: 1.5,
          borderLeft: 3,
          borderColor: "divider",
          fontStyle: "italic",
        }}
      >
        <Typography variant="body2">{paragraph}</Typography>
      </Box>
    </Alert>
  );
}
