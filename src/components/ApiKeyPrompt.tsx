import { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
} from "@mui/material";
import { setApiKey } from "../auth/apiKey";

type Props = {
  onSaved: () => void;
};

export default function ApiKeyPrompt({ onSaved }: Props) {
  const [value, setValue] = useState("");

  const handleSave = () => {
    if (!value.trim()) return;
    setApiKey(value.trim());
    onSaved();
  };

  return (
    <Box
      minHeight="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      px={2}
    >
      <Paper sx={{ p: 3, width: "100%", maxWidth: 400 }}>
        <Typography variant="h6" gutterBottom>
          Enter API Key
        </Typography>

        <TextField
          label="x-wmsfo-key"
          fullWidth
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          margin="normal"
        />

        <Button
          fullWidth
          variant="contained"
          onClick={handleSave}
          sx={{ mt: 2 }}
        >
          Continue
        </Button>
      </Paper>
    </Box>
  );
}
