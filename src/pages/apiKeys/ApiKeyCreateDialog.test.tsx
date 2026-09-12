import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { NotifyProvider } from "../../hooks/useNotify";
import { buildTheme } from "../../theme/theme";
import ApiKeyCreateDialog from "./ApiKeyCreateDialog";
import type { ApiKeyCreateBody } from "../../api/resources/apiKeys";
import { ApiError } from "../../api/errors";

function renderDialog(opts?: {
  submitting?: boolean;
  error?: unknown;
  onSubmit?: (body: ApiKeyCreateBody) => void;
  onCancel?: () => void;
}) {
  const onSubmit = opts?.onSubmit ?? vi.fn();
  const onCancel = opts?.onCancel ?? vi.fn();
  render(
    <ThemeProvider theme={buildTheme("light")}>
      <CssBaseline />
      <NotifyProvider>
        <ApiKeyCreateDialog
          open={true}
          submitting={opts?.submitting ?? false}
          error={opts?.error ?? null}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      </NotifyProvider>
    </ThemeProvider>
  );
  return { onSubmit, onCancel };
}

describe("ApiKeyCreateDialog validation", () => {
  it("requires a non-empty name", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects a name longer than 100 characters", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();
    const nameInput = screen.getByLabelText(/^name$/i) as HTMLInputElement;
    // maxLength on the input already caps the value at 100, so type 101
    // and expect the input to be truncated: submission should therefore
    // succeed. We instead simulate the too-long value directly through
    // the input's setter to bypass the maxLength.
    const proto = window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter?.call(nameInput, "a".repeat(101));
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    expect(
      await screen.findByText(/100 characters or fewer/i)
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("with 'All capabilities' off, requires at least one capability", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();
    await user.type(screen.getByLabelText(/^name$/i), "claude-code");
    await user.click(screen.getByLabelText(/^all capabilities$/i));
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    expect(
      await screen.findByText(/choose at least one capability/i)
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("with 'Never expires' off, requires an expiry at least one hour ahead", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();
    await user.type(screen.getByLabelText(/^name$/i), "claude-code");
    await user.click(screen.getByLabelText(/^never expires$/i));

    // 30 minutes ahead: fails.
    const soon = new Date(Date.now() + 30 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(
      soon.getDate()
    )}T${pad(soon.getHours())}:${pad(soon.getMinutes())}`;
    const input = screen.getByLabelText(/^expires at$/i) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    setter?.call(input, local);
    input.dispatchEvent(new Event("input", { bubbles: true }));

    await user.click(screen.getByRole("button", { name: /^create$/i }));
    expect(
      await screen.findByText(/at least one hour ahead/i)
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits allCapabilities true with empty capabilities and null expiry when the switches are on", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog({ onSubmit });
    await user.type(screen.getByLabelText(/^name$/i), "claude-code");
    await user.click(screen.getByRole("button", { name: /^create$/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({
      name: "claude-code",
      allCapabilities: true,
      capabilities: [],
      expiresAt: null,
    });
  });

  it("submits chosen capabilities and an ISO expiresAt when both are set", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderDialog({ onSubmit });
    await user.type(screen.getByLabelText(/^name$/i), "claude-code");
    await user.click(screen.getByLabelText(/^all capabilities$/i));

    // Toggle two capabilities.
    await user.click(screen.getByLabelText(/^pages$/i));
    await user.click(screen.getByLabelText(/^media$/i));

    // Set an expiry two hours ahead.
    await user.click(screen.getByLabelText(/^never expires$/i));
    const soon = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(
      soon.getDate()
    )}T${pad(soon.getHours())}:${pad(soon.getMinutes())}`;
    const input = screen.getByLabelText(/^expires at$/i) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    setter?.call(input, local);
    input.dispatchEvent(new Event("input", { bubbles: true }));

    await user.click(screen.getByRole("button", { name: /^create$/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const body = onSubmit.mock.calls[0]![0] as ApiKeyCreateBody;
    expect(body.name).toBe("claude-code");
    expect(body.allCapabilities).toBe(false);
    expect(body.capabilities).toEqual(["pages", "media"]);
    expect(body.expiresAt).not.toBeNull();
    const t = Date.parse(body.expiresAt ?? "");
    expect(t - Date.now()).toBeGreaterThan(60 * 60 * 1000);
  });

  it("renders a field error on the Name input when the server returns 409 name_taken", async () => {
    renderDialog({
      error: new ApiError(409, {
        code: "name_taken",
        message: "taken",
        details: null,
        requestId: "r1",
      }),
    });
    expect(
      await screen.findByText(
        /a key with this name exists; revoke it or pick another name/i
      )
    ).toBeInTheDocument();
  });
});
