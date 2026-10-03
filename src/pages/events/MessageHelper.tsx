import { Box } from "@mui/material";
import { MESSAGE_HELPER } from "../../lib/statusCopy";

// Helper line of the status and notify message fields: what the message
// does, then the character counter on the same line.
export default function MessageHelper({ length }: { length: number }) {
  return (
    <Box
      component="span"
      sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}
    >
      <span>{MESSAGE_HELPER}</span>
      <Box component="span" sx={{ whiteSpace: "nowrap" }}>
        {length} / 1000
      </Box>
    </Box>
  );
}
