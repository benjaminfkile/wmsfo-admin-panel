// The help editor: validation messages, a destination picked from the
// route list, a free https:// destination, a refused ftp:// one, Save
// PUTs the body and toasts, and Reset confirms and POSTs.

import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import HelpEditDialog from "./HelpEditDialog";
import { server } from "../test/msw/server";
import { testConfig } from "../test/renderWithProviders";
import { HelpHarness, signInAs } from "../test/helpHarness";
import * as f from "../test/msw/fixtures";
import type { HelpTopic } from "../api/types";

afterEach(() => {
  server.resetHandlers();
});

function topic(key: string): HelpTopic {
  const t = f.helpTopics.find((x) => x.key === key);
  if (!t) throw new Error(key);
  return t;
}

function renderDialog(key: string, data: HelpTopic | undefined, onClose = () => undefined) {
  const um = signInAs("admin");
  return render(
    <HelpHarness userManager={um}>
      <HelpEditDialog open helpKey={key} topic={data} onClose={onClose} />
    </HelpHarness>
  );
}

function capturePut() {
  const seen: Array<{ key: string; body: unknown }> = [];
  server.use(
    http.put(`${testConfig.apiBaseUrl}/admin/help/:key`, async ({ params, request }) => {
      const body = await request.json();
      seen.push({ key: String(params.key), body });
      return HttpResponse.json({ ...topic("events.create"), ...(body as object), edited: true });
    })
  );
  return seen;
}

describe("HelpEditDialog", () => {
  it("shows the validation messages and sends nothing", async () => {
    const seen = capturePut();
    renderDialog("events.create", topic("events.create"));
    await userEvent.clear(screen.getByLabelText("Title"));
    await userEvent.clear(screen.getByLabelText("Body"));
    await userEvent.click(screen.getByRole("button", { name: "Add link" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Title is required")).toBeInTheDocument();
    expect(screen.getByText("Body is required")).toBeInTheDocument();
    expect(screen.getByText("Label is required")).toBeInTheDocument();
    expect(screen.getByText("Destination is required")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "x".repeat(121) } });
    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "y".repeat(700) } });
    expect(screen.getByText(/Keep it short: a popover/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Title is at most 120 characters")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Body"), { target: { value: "y".repeat(2001) } });
    expect(screen.getByText("Body is at most 2000 characters")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(seen).toEqual([]);
  });

  it("caps the links at six", async () => {
    renderDialog("events.create", topic("events.create"));
    const add = screen.getByRole("button", { name: "Add link" });
    for (let i = 0; i < 6; i++) await userEvent.click(add);
    expect(add).toBeDisabled();
  });

  it("saves a route picked from the list and a free https:// link, toasts, and closes", async () => {
    const seen = capturePut();
    let closed = false;
    renderDialog("events.create", topic("events.create"), () => {
      closed = true;
    });
    await userEvent.click(screen.getByRole("button", { name: "Add link" }));
    const row0 = screen.getByTestId("help-link-0");
    await userEvent.type(within(row0).getByLabelText("Label"), "Beacons");
    await userEvent.type(within(row0).getByLabelText("Destination"), "/bea");
    await userEvent.click(await screen.findByRole("option", { name: "/beacons (Beacons)" }));
    expect(within(row0).getByLabelText("Destination")).toHaveValue("/beacons");

    await userEvent.click(screen.getByRole("button", { name: "Add link" }));
    const row1 = screen.getByTestId("help-link-1");
    await userEvent.type(within(row1).getByLabelText("Label"), "Guide");
    await userEvent.type(
      within(row1).getByLabelText("Destination"),
      "https://guide.example.com/events"
    );

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toEqual({
      key: "events.create",
      body: {
        title: "Create an event",
        body: "Name the event and pick its year.",
        links: [
          { label: "Beacons", to: "/beacons" },
          { label: "Guide", to: "https://guide.example.com/events" },
        ],
      },
    });
    expect(await screen.findByText("Help saved")).toBeInTheDocument();
    expect(closed).toBe(true);
  });

  it("refuses an ftp:// destination", async () => {
    const seen = capturePut();
    renderDialog("events.create", topic("events.create"));
    await userEvent.click(screen.getByRole("button", { name: "Add link" }));
    const row = screen.getByTestId("help-link-0");
    await userEvent.type(within(row).getByLabelText("Label"), "Files");
    await userEvent.type(within(row).getByLabelText("Destination"), "ftp://files.example.com");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Starts with / or https://")).toBeInTheDocument();
    expect(seen).toEqual([]);
  });

  it("offers Reset only on an edited topic, confirms, and POSTs the reset", async () => {
    const reset: string[] = [];
    server.use(
      http.post(`${testConfig.apiBaseUrl}/admin/help/:key/reset`, ({ params }) => {
        reset.push(String(params.key));
        return HttpResponse.json({ ...topic("events"), edited: false });
      })
    );
    const { unmount } = renderDialog("events.create", topic("events.create"));
    expect(screen.queryByRole("button", { name: "Reset to default" })).not.toBeInTheDocument();
    unmount();

    renderDialog("events", topic("events"));
    await userEvent.click(screen.getByRole("button", { name: "Reset to default" }));
    expect(
      await screen.findByText("Replace your text with the shipped default?")
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => expect(reset).toEqual(["events"]));
    expect(await screen.findByText("Help reset")).toBeInTheDocument();
  });
});
