import {
  Box,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material";
import {
  POI_CATEGORIES,
  categoriesFor,
  poisFor,
  storedKinds,
  type PoisValue,
} from "../routePreviewPois";

interface Props {
  value: unknown;
  onChange: (next: PoisValue | undefined) => void;
  title?: string;
  help?: string;
  disabled?: boolean;
}

// A `pois` value as a Default / Custom choice. Default reports undefined
// (no key); Custom shows one checkbox per category of POI_CATEGORIES and
// reports `{ kinds }`, the union of the checked categories' kinds (an
// empty list when none is checked). A stored list shows each category
// checked whose every kind it holds.
export default function PoisEditor({
  value,
  onChange,
  title = "Points of interest",
  help,
  disabled = false,
}: Props) {
  const kinds = storedKinds(value);
  const custom = kinds !== null;
  const checked = new Set(categoriesFor(kinds ?? []));

  const write = (choice: "default" | "custom", ids: Iterable<string>) => {
    onChange(poisFor(choice, ids, kinds ?? []));
  };

  const toggle = (id: string, on: boolean) => {
    const next = new Set(checked);
    if (on) next.add(id);
    else next.delete(id);
    write("custom", next);
  };

  return (
    <Box sx={{ my: 1, minWidth: 0 }} data-testid="pois-field">
      <Typography variant="subtitle2" id="pois-field-title">
        {title}
      </Typography>
      {help ? (
        <Typography variant="caption" color="text.secondary" component="p">
          {help}
        </Typography>
      ) : null}
      <RadioGroup
        row
        aria-labelledby="pois-field-title"
        value={custom ? "custom" : "default"}
        onChange={(e) =>
          write(e.target.value === "custom" ? "custom" : "default", [])
        }
      >
        <FormControlLabel
          value="default"
          control={<Radio />}
          label="Default"
          disabled={disabled}
        />
        <FormControlLabel
          value="custom"
          control={<Radio />}
          label="Custom"
          disabled={disabled}
        />
      </RadioGroup>
      {custom ? (
        <FormGroup sx={{ pl: 1 }} data-testid="pois-categories">
          {POI_CATEGORIES.map((c) => (
            <FormControlLabel
              key={c.id}
              control={
                <Checkbox
                  checked={checked.has(c.id)}
                  onChange={(e) => toggle(c.id, e.target.checked)}
                />
              }
              label={c.label}
              disabled={disabled}
            />
          ))}
          {checked.size === 0 ? (
            <Typography variant="caption" color="text.secondary">
              Nothing checked: the map shows no places.
            </Typography>
          ) : null}
        </FormGroup>
      ) : null}
    </Box>
  );
}
