// The Clear current event control on the event page:
//   - shown only on the current event, and only to an admin
//   - disabled with "A live event stays current." while the event is live
//   - Confirm calls DELETE /admin/events/{id}/current and toasts
//     "No event is current"
//   - a 409 current_event_live shows "A live event stays current." as an error

import { describe, expect, it, afterEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { UserManager } from "oidc-client-ts";
import ClearCurrentEvent from "./ClearCurrentEvent";
import { NotifyProvider } from "../../hooks/useNotify";
import { installClient } from "../../api/client";
import { server } from "../../test/msw/server";
import * as f from "../../test/msw/fixtures";
import type { Event } from "../../api/types";
import {
  makeFakeUserManager,
  makeUser,
  renderWithProviders,
  testConfig,
} from "../../test/renderWithProviders";

const API = testConfig.apiBaseUrl;
const CURRENT: Event = { ...f.events[0]!, isCurrent: true, statusId: 2 };

function userManagerFor(group: string): UserManager {
  const um = makeFakeUserManager(
    makeUser({ email: `${group}@example.com`, "cognito:groups": [group] })
  );
  installClient({
    config: testConfig,
    userManager: um,
    onMfaRequired: () => undefined,
  });
  return um;
}

function renderControl(event: Event, group = "admin") {
  return renderWithProviders(
    <NotifyProvider>
      <ClearCurrentEvent event={event} />
    </NotifyProvider>,
    { userManager: userManagerFor(group) }
  );
}

afterEach(() => {
  server.resetHandlers();
});

describe("ClearCurrentEvent", () => {
  it("shows the button on the current event", async () => {
    renderControl(CURRENT);
    expect(
      await screen.findByRole("button", { name: "Clear current event" })
    ).toBeEnabled();
  });

  it("shows no button on an event that is not current", async () => {
    renderControl({ ...CURRENT, isCurrent: false });
    // Let the auth state settle before asserting the absence.
    await new Promise((r) => setTimeout(r, 0));
    expect(
      screen.queryByRole("button", { name: "Clear current event" })
    ).toBeNull();
  });

  it("shows no button to an editor", async () => {
    renderControl(CURRENT, "editor");
    // Let the auth state settle before asserting the absence.
    await new Promise((r) => setTimeout(r, 0));
    expect(
      screen.queryByRole("button", { name: "Clear current event" })
    ).toBeNull();
  });

  it("is disabled with the helper text while the event is live", async () => {
    renderControl({ ...CURRENT, statusId: 3 });
    const button = await screen.findByRole("button", {
      name: "Clear current event",
    });
    expect(button).toBeDisabled();
    expect(screen.getByText("A live event stays current.")).toBeInTheDocument();
  });

  it("Confirm calls DELETE /admin/events/{id}/current and toasts", async () => {
    const user = userEvent.setup();
    const deletes: string[] = [];
    server.use(
      http.delete(`${API}/admin/events/:id/current`, ({ request }) => {
        deletes.push(new URL(request.url).pathname);
        return HttpResponse.json({ ...CURRENT, isCurrent: false });
      })
    );
    renderControl(CURRENT);
    await user.click(
      await screen.findByRole("button", { name: "Clear current event" })
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(
        `With no current event, the site shows the Off season page. Clear ${CURRENT.name} as the current event?`
      )
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Clear current event" })
    );
    await waitFor(() =>
      expect(deletes).toEqual([`/admin/events/${CURRENT.id}/current`])
    );
    expect(await screen.findByText("No event is current")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("a 409 current_event_live shows the live text as an error", async () => {
    const user = userEvent.setup();
    server.use(
      http.delete(`${API}/admin/events/:id/current`, () =>
        HttpResponse.json(
          {
            code: "current_event_live",
            message: "The current event is live",
            details: null,
            requestId: "r1",
          },
          { status: 409 }
        )
      )
    );
    renderControl(CURRENT);
    await user.click(
      await screen.findByRole("button", { name: "Clear current event" })
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Clear current event" })
    );
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("A live event stays current.");
    expect(screen.queryByText("No event is current")).toBeNull();
  });
});
