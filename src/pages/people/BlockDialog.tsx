import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  DialogActions,
  DialogContent,
  FormControlLabel,
  InputAdornment,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery } from "@tanstack/react-query";
import AppDialog from "../../components/AppDialog";
import ErrorAlert from "../../components/ErrorAlert";
import DialogTitleWithHelp from "../../help/DialogTitleWithHelp";
import { ApiError } from "../../api/errors";
import { people as peopleApi } from "../../api/resources/people";
import { keys } from "../../queries/keys";
import { fieldErrorFor } from "../../lib/fieldErrors";
import {
  IMPACT_DEBOUNCE_MS,
  NOTE_MAX,
  accounts,
  patternValid,
  toPattern,
  type BlockKind,
} from "./blocks";


function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

interface Props {
  open: boolean;
  onCancel: () => void;
  // Called after the block is written, with the accounts it removed.
  onBlocked: (removed: number) => void;
}

export default function BlockDialog({ open, onCancel, onBlocked }: Props) {
  const [kind, setKind] = useState<BlockKind>("address");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [debounced, setDebounced] = useState("");

  const pattern = toPattern(kind, text);
  const valid = patternValid(kind, pattern);

  const createMut = useMutation({
    mutationFn: () =>
      peopleApi.blocks.create({ pattern, note: note.trim() }),
  });
  const { reset } = createMut;

  useEffect(() => {
    if (open) {
      setKind("address");
      setText("");
      setNote("");
      setDebounced("");
      reset();
    }
  }, [open, reset]);

  // The impact is read once the pattern validates and the typing has
  // paused for IMPACT_DEBOUNCE_MS.
  useEffect(() => {
    if (!valid) {
      setDebounced("");
      return;
    }
    const t = setTimeout(() => setDebounced(pattern), IMPACT_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [pattern, valid]);

  const impactQ = useQuery({
    queryKey: [...keys.peopleBlocks, "impact", debounced],
    queryFn: () => peopleApi.blocks.impact(debounced),
    enabled: open && debounced !== "",
    staleTime: 0,
    gcTime: 0,
  });

  const impact =
    debounced === pattern && impactQ.data?.pattern === pattern
      ? impactQ.data
      : undefined;
  const removing = impact?.people?.length ?? 0;
  const noteOk = note.trim().length >= 1 && note.trim().length <= NOTE_MAX;

  const error = createMut.error;
  const exists = error instanceof ApiError && error.code === "block_exists";
  const upstream = error instanceof ApiError && error.status === 502;
  const patternError = exists
    ? "Already blocked."
    : (fieldErrorFor(error, "pattern") ?? null);
  const noteError = fieldErrorFor(error, "note");

  const confirm = () => {
    createMut.mutate(undefined, { onSuccess: () => onBlocked(removing) });
  };

  const confirmDisabled =
    !valid || !noteOk || !impact || createMut.isPending;

  const changeText = (v: string) => {
    setText(v);
    if (createMut.error) reset();
  };

  return (
    <AppDialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitleWithHelp help="people.block">
        Block an address or a domain
      </DialogTitleWithHelp>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && !exists ? (
            upstream ? (
              <Alert severity="error" role="alert">
                {error.message}
              </Alert>
            ) : (
              <ErrorAlert error={error} handledFields={["pattern", "note"]} />
            )
          ) : null}
          <RadioGroup
            row
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as BlockKind);
              if (createMut.error) reset();
            }}
          >
            <FormControlLabel
              value="address"
              control={<Radio />}
              label="An address"
            />
            <FormControlLabel
              value="domain"
              control={<Radio />}
              label="A domain"
            />
          </RadioGroup>
          <TextField
            label={kind === "address" ? "Address" : "Domain"}
            placeholder={kind === "address" ? "jane@example.com" : "example.com"}
            value={text}
            onChange={(e) => changeText(e.target.value)}
            error={Boolean(patternError) || (text.trim() !== "" && !valid)}
            helperText={
              patternError ??
              (text.trim() !== "" && !valid
                ? kind === "address"
                  ? "Enter an email address"
                  : "Enter a domain such as example.com"
                : kind === "domain"
                  ? "Every address at this domain"
                  : " ")
            }
            slotProps={{
              input:
                kind === "domain"
                  ? {
                      startAdornment: (
                        <InputAdornment position="start">*@</InputAdornment>
                      ),
                    }
                  : undefined,
              htmlInput: { maxLength: 254, "data-testid": "block-pattern" },
            }}
            fullWidth
            autoFocus
          />
          <TextField
            label="Note"
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
            error={Boolean(noteError)}
            helperText={noteError ?? `Why this is blocked (${note.trim().length}/${NOTE_MAX})`}
            slotProps={{ htmlInput: { maxLength: NOTE_MAX } }}
            multiline
            minRows={2}
            fullWidth
          />

          <Box data-testid="block-impact" aria-live="polite">
            {!valid ? null : impactQ.error && debounced === pattern ? (
              <ErrorAlert error={impactQ.error} />
            ) : !impact ? (
              <Stack alignItems="center" sx={{ py: 1 }}>
                <CircularProgress size={20} />
              </Stack>
            ) : removing === 0 ? (
              <Typography variant="body2">No account matches.</Typography>
            ) : (
              <Alert severity="warning">
                <Typography variant="body2">
                  These accounts will be removed and signed out everywhere,
                  with their cookies and subscriptions:
                </Typography>
                <Box component="ul" sx={{ my: 1, pl: 3 }}>
                  {(impact.people ?? []).map((p) => (
                    <li key={String(p.id)}>
                      <Typography
                        variant="body2"
                        sx={{ wordBreak: "break-all" }}
                      >
                        {p.email}
                      </Typography>
                    </li>
                  ))}
                </Box>
                <Typography variant="body2">
                  {`${plural(Number(impact.subscriptions ?? 0), "subscription", "subscriptions")}, ${plural(Number(impact.cookies ?? 0), "cookie", "cookies")}.`}
                </Typography>
              </Alert>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button
          color="error"
          variant="contained"
          onClick={confirm}
          disabled={confirmDisabled}
        >
          {removing > 0 ? `Block and remove ${accounts(removing)}` : "Block"}
        </Button>
      </DialogActions>
    </AppDialog>
  );
}
