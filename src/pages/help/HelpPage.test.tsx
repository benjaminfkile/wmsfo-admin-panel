// admin.md 6.26: the Help page groups the registry by page, searches
// key, title, and body, filters Unwritten and Default changed, and gives
// admins the edit pencil.

import { afterEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HelpPage from "./HelpPage";
import { server } from "../../test/msw/server";
import { HelpHarness, signInAs } from "../../test/helpHarness";
import type { Role } from "../../auth/claims";

afterEach(() => {
  server.resetHandlers();
});

function renderPage(role: Role = "admin") {
  const um = signInAs(role);
  return render(
    <HelpHarness userManager={um} route="/help">
      <HelpPage />
    </HelpHarness>
  );
}

function groupNames(): string[] {
  return screen
    .queryAllByTestId(/^help-group-/)
    .map((g) => g.getAttribute("data-testid")!.replace("help-group-", ""));
}

describe("HelpPage", () => {
  it("renders one table per page in registry order with the topic columns", async () => {
    renderPage();
    const row = await screen.findByTestId("help-row-dashboard");
    expect(groupNames().slice(0, 3)).toEqual(["Dashboard", "Events", "Flight recordings"]);
    expect(within(row).getByText("Dashboard overview")).toBeInTheDocument();
    expect(within(row).getByText("What the dashboard shows")).toBeInTheDocument();
    expect(
      within(row).getByText("The dashboard sums up the live state. - The current event - The active beacon")
    ).toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument();
    const edited = screen.getByTestId("help-row-dashboard.current-event");
    expect(within(edited).getByText("Edited")).toBeInTheDocument();
    expect(within(edited).getByText(/admin@example\.com/)).toBeInTheDocument();
    expect(screen.queryByTestId("help-help")).not.toBeInTheDocument();
  });

  it("searches key, title, and body", async () => {
    renderPage();
    await screen.findByTestId("help-row-dashboard");
    const search = screen.getByLabelText("Search");
    await userEvent.type(search, "newest first");
    expect(groupNames()).toEqual(["Events"]);
    expect(screen.getByTestId("help-row-events")).toBeInTheDocument();
    expect(screen.queryByTestId("help-row-events.create")).not.toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, "email-quota");
    expect(screen.getByTestId("help-row-dashboard.email-quota")).toBeInTheDocument();
    expect(groupNames()).toEqual(["Dashboard"]);

    await userEvent.clear(search);
    await userEvent.type(search, "Create an event");
    expect(screen.getByTestId("help-row-events.create")).toBeInTheDocument();
    expect(groupNames()).toEqual(["Events"]);
  });

  it("filters Unwritten and Default changed", async () => {
    renderPage();
    await screen.findByTestId("help-row-dashboard");
    await userEvent.click(screen.getByRole("button", { name: "Unwritten" }));
    expect(screen.getByTestId("help-row-dashboard.email-quota")).toBeInTheDocument();
    expect(screen.getByTestId("help-row-drawer")).toBeInTheDocument();
    expect(screen.queryByTestId("help-row-dashboard")).not.toBeInTheDocument();
    expect(screen.queryByTestId("help-row-events")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Unwritten" }));

    await userEvent.click(screen.getByRole("button", { name: "Default changed" }));
    expect(groupNames()).toEqual(["Events"]);
    expect(screen.getByTestId("help-row-events")).toBeInTheDocument();
    expect(screen.queryByTestId("help-row-events.create")).not.toBeInTheDocument();
  });

  it("gives admins the pencil that opens the editor", async () => {
    renderPage("admin");
    await screen.findByTestId("help-row-dashboard");
    await userEvent.click(screen.getByRole("button", { name: "Edit Events list" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Title")).toHaveValue("Every event");
    expect(within(dialog).getByRole("button", { name: "Reset to default" })).toBeInTheDocument();
  });

  it("shows no pencil to an editor", async () => {
    renderPage("editor");
    await screen.findByTestId("help-row-dashboard");
    expect(screen.queryByRole("button", { name: "Edit Events list" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit / })).not.toBeInTheDocument();
  });
});
