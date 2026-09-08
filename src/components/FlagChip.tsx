import { Chip } from "@mui/material";
import { FLAG_LABEL, type BeaconFlag } from "../lib/beaconFlags";

interface Props {
  flag: BeaconFlag;
}

export default function FlagChip({ flag }: Props) {
  return (
    <Chip
      size="small"
      color="error"
      variant="filled"
      label={FLAG_LABEL[flag]}
      data-flag={flag}
    />
  );
}
