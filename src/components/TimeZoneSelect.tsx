import { useMemo } from "react";
import { Autocomplete, TextField } from "@mui/material";
import { timeZoneOptions } from "../lib/time";

interface Props {
  value: string;
  onChange: (zone: string) => void;
  helperText?: string;
}

// A filterable select of IANA zones. The current value is always among
// the options, even when the runtime does not list it.
export default function TimeZoneSelect({ value, onChange, helperText }: Props) {
  const options = useMemo(() => timeZoneOptions(value), [value]);
  return (
    <Autocomplete
      options={options}
      value={value}
      onChange={(_, next) => {
        if (next) onChange(next);
      }}
      disableClearable
      autoHighlight
      fullWidth
      renderInput={(params) => (
        <TextField {...params} label="Timezone" helperText={helperText} />
      )}
    />
  );
}
