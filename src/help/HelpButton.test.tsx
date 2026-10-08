// The help button and its popover: the desktop popover with title, body,
// and links; internal links navigate and close; external links open a
// new tab; compact renders a dialog; Edit is for admins only; a topic
// with no text shows the unwritten sentence.

import { afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import HelpButton from "./HelpButton";
import { server } from "../test/msw/server";
import { testConfig } from "../test/renderWithProviders";
import { HelpHarness, signInAs, stubMatchMedia } from "../test/helpHarness";
import * as f from "../test/msw/fixtures";
import type { HelpKey } from "./helpKeys";
import type { Role } from "../auth/claims";

let restore: (() => void) | null = null;

afterEach(() => {
  restore?.();
  restore = null;
  server.resetHandlers();
});

function renderButton(topic: HelpKey, role: Role = "editor") {
  const um = signInAs(role);
  return render(
    <HelpHarness userManager={um} route="/somewhere">
      <HelpButton topic={topic} />
    </HelpHarness>
  );
}

describe("HelpButton and HelpPopover", () => {
  it("opens a popover with the title, the body, and the links on desktop", async () => {
    renderButton("dashboard");
    const button = await screen.findByRole("button", {
      name: "Help: What the dashboard shows",
    });
    expect(button).toHaveAttribute("data-testid", "help-dashboard");
    await userEvent.click(button);
    const popover = await screen.findByRole("presentation");
    expect(within(popover).getByText("What the dashboard shows")).toBeInTheDocument();
    expect(within(popover).getByText("The dashboard sums up the live state.")).toBeInTheDocument();
    expect(within(popover).getAllByRole("listitem").length).toBeGreaterThanOrEqual(2);
    expect(within(popover).getByText("See also")).toBeInTheDocument();
    expect(within(popover).getByRole("link", { name: "Events" })).toHaveAttribute(
      "href",
      "/events"
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("names the button by the registry label while the topic is unknown", async () => {
    renderButton("dashboard");
    expect(
      screen.getByRole("button", { name: "Help: Dashboard overview" })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Help: What the dashboard shows" })
    ).toBeInTheDocument();
  });

  it("navigates on an internal link and closes the popover", async () => {
    renderButton("dashboard");
    await userEvent.click(
      await screen.findByRole("button", { name: "Help: What the dashboard shows" })
    );
    await userEvent.click(await screen.findByRole("link", { name: "Events" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/events");
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Events" })).not.toBeInTheDocument()
    );
  });

  it("opens an external link in a new tab", async () => {
    renderButton("dashboard");
    await userEvent.click(
      await screen.findByRole("button", { name: "Help: What the dashboard shows" })
    );
    const link = await screen.findByRole("link", { name: "Status page" });
    expect(link).toHaveAttribute("href", "https://status.example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");
  });

  it("renders the help in a dialog on compact", async () => {
    restore = stubMatchMedia(true);
    renderButton("dashboard");
    await userEvent.click(
      await screen.findByRole("button", { name: "Help: What the dashboard shows" })
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("What the dashboard shows")).toBeInTheDocument();
    expect(within(dialog).getByText("The dashboard sums up the live state.")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows Edit to an admin and opens the editor", async () => {
    renderButton("dashboard", "admin");
    await userEvent.click(
      await screen.findByRole("button", { name: "Help: What the dashboard shows" })
    );
    await userEvent.click(await screen.findByRole("button", { name: "Edit this help" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Title")).toHaveValue("What the dashboard shows");
  });

  it("hides Edit from an editor", async () => {
    renderButton("dashboard", "editor");
    await userEvent.click(
      await screen.findByRole("button", { name: "Help: What the dashboard shows" })
    );
    await screen.findByText("The dashboard sums up the live state.");
    expect(screen.queryByRole("button", { name: "Edit this help" })).not.toBeInTheDocument();
  });

  it("shows the unwritten state for an empty body and for a topic the API did not return", async () => {
    server.use(
      http.get(`${testConfig.apiBaseUrl}/admin/help`, () =>
        HttpResponse.json({ items: f.helpTopics.filter((t) => t.key !== "drawer") })
      )
    );
    const um = signInAs("admin");
    render(
      <HelpHarness userManager={um}>
        <HelpButton topic="dashboard.email-quota" />
        <HelpButton topic="drawer" />
      </HelpHarness>
    );
    await userEvent.click(await screen.findByRole("button", { name: "Help: Email quota" }));
    expect(await screen.findByText("No help written yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit this help" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByText("No help written yet.")).not.toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole("button", { name: "Help: Navigation drawer" }));
    const popover = await screen.findByRole("presentation");
    expect(within(popover).getByText("Navigation drawer")).toBeInTheDocument();
    expect(within(popover).getByText("No help written yet.")).toBeInTheDocument();
    expect(within(popover).getByRole("button", { name: "Edit this help" })).toBeInTheDocument();
  });
});
