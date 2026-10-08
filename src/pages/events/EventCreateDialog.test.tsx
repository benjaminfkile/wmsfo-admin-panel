import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CssBaseline, ThemeProvider } from "@mui/material";
import EventCreateDialog from "./EventCreateDialog";
import type { CreateEventBody } from "../../api/resources/events";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { buildTheme } from "../../theme/theme";
import { formatStamp } from "../../lib/time";

vi.setConfig({ testTimeout: 15_000 });

// The browser zone comes from Intl's resolved options; pin it so the
// default is predictable.
beforeEach(() => {
  const real = Intl.DateTimeFormat.prototype.resolvedOptions;
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(
    function (this: Intl.DateTimeFormat) {
      return { ...real.call(this), timeZone: "America/Denver" };
    }
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderDialog(onSubmit: (b: CreateEventBody) => void) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider theme={buildTheme("light")}>
        <CssBaseline />
        <EventCreateDialog
          open
          events={[]}
          routes={[]}
          submitting={false}
          error={null}
          onCancel={() => undefined}
          onSubmit={onSubmit}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe("EventCreateDialog: timezone", () => {
  it("defaults the zone to the browser zone and reads the scheduled time in it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit);
    expect(screen.getByTestId("help-events.create")).toBeInTheDocument();

    expect(screen.getByRole("combobox", { name: /timezone/i })).toHaveValue(
      "America/Denver"
    );
    await user.type(screen.getByLabelText(/^name/i), "Night flight");
    fireEvent.change(screen.getByLabelText(/scheduled at/i), {
      target: { value: "2026-11-01T01:30" },
    });
    await user.click(screen.getByLabelText(/no route/i));
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const body = onSubmit.mock.calls[0]![0] as CreateEventBody;
    expect(body.scheduledAt).toBe("2026-11-01T07:30:00.000Z");
    expect(body.scheduleTimeZone).toBe("America/Denver");
  });

  it("sends the picked zone and converts the wall time through it", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog(onSubmit);

    const zone = screen.getByRole("combobox", { name: /timezone/i });
    await user.click(zone);
    await user.clear(zone);
    await user.type(zone, "Asia/Tok");
    await user.click(await screen.findByRole("option", { name: "Asia/Tokyo" }));
    expect(zone).toHaveValue("Asia/Tokyo");

    await user.type(screen.getByLabelText(/^name/i), "Tokyo flight");
    fireEvent.change(screen.getByLabelText(/scheduled at/i), {
      target: { value: "2026-12-24T19:00" },
    });
    // The helper text shows the instant in the viewer's zone.
    expect(
      screen.getByText(formatStamp("2026-12-24T10:00:00.000Z"))
    ).toBeInTheDocument();
    await user.click(screen.getByLabelText(/no route/i));
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    const body = onSubmit.mock.calls[0]![0] as CreateEventBody;
    expect(body.scheduledAt).toBe("2026-12-24T10:00:00.000Z");
    expect(body.scheduleTimeZone).toBe("Asia/Tokyo");
  });
});
