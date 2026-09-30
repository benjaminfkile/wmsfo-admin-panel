// admin.md 6.13, the page's Menu icon:
//   - the create dialog sends the picked icon, or null when none is set
//     or it was cleared
//   - the settings dialog shows the saved icon, edits it, clears it,
//     and a saved icon reads back unchanged on the next save

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  screen,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import PageCreateDialog, { type PageCreateSubmit } from "./PageCreateDialog";
import PageSettingsDialog, {
  type PageSettingsSubmit,
} from "./PageSettingsDialog";
import { installClient } from "../../api/client";
import { server } from "../../test/msw/server";
import * as f from "../../test/msw/fixtures";
import {
  makeFakeUserManager,
  makeUser,
  renderWithProviders,
  testConfig,
} from "../../test/renderWithProviders";
import type { Icon, PageAdmin } from "../../api/types";

const um = makeFakeUserManager(
  makeUser({ email: "admin@example.com", "cognito:groups": ["admin"] })
);

beforeEach(() => {
  installClient({
    config: testConfig,
    userManager: um,
    onMfaRequired: () => undefined,
  });
});

afterEach(() => {
  server.resetHandlers();
});

// Opens the icon picker from the Menu icon field and picks the library
// icon "cookie".
async function pickCookie(user: UserEvent) {
  const field = screen.getByTestId("page-icon-field");
  await user.click(within(field).getByRole("button", { name: "Choose" }));
  const picker = await screen.findByRole("dialog", { name: "Choose menu icon" });
  await user.click(await within(picker).findByTestId("icon-tile-cookie"));
  await user.click(within(picker).getByRole("button", { name: "Choose" }));
  await waitForElementToBeRemoved(() =>
    screen.queryByRole("dialog", { name: "Choose menu icon" })
  );
}

describe("PageCreateDialog: Menu icon", () => {
  function renderCreate(submits: PageCreateSubmit[]) {
    renderWithProviders(
      <PageCreateDialog
        open
        onCancel={() => undefined}
        onCreate={(b) => submits.push(b)}
      />,
      { userManager: um }
    );
  }

  it("shows the label and its one line of help", () => {
    renderCreate([]);
    const field = screen.getByTestId("page-icon-field");
    expect(within(field).getByText("Menu icon")).toBeInTheDocument();
    expect(within(field).getByTestId("page-icon-help")).toHaveTextContent(
      "The site shows this beside the page in the mobile menu."
    );
    expect(within(field).getByText("None")).toBeInTheDocument();
  });

  it("sends the icon picked at create", async () => {
    const user = userEvent.setup();
    const submits: PageCreateSubmit[] = [];
    renderCreate(submits);
    await user.type(screen.getByLabelText(/^Title/), "Donate");
    await pickCookie(user);
    const field = screen.getByTestId("page-icon-field");
    expect(await within(field).findByTestId("icon-preview-image")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(submits).toEqual([
      {
        slug: "donate",
        title: "Donate",
        navLabel: "Donate",
        icon: { source: "library", id: "cookie" },
      },
    ]);
  });

  it("sends null with no icon, and after a picked icon is cleared", async () => {
    const user = userEvent.setup();
    const submits: PageCreateSubmit[] = [];
    renderCreate(submits);
    await user.type(screen.getByLabelText(/^Title/), "Donate");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await pickCookie(user);
    const field = screen.getByTestId("page-icon-field");
    await user.click(within(field).getByRole("button", { name: "Clear" }));
    expect(within(field).getByText("None")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(submits.map((s) => s.icon)).toEqual([null, null]);
  });
});

describe("PageSettingsDialog: Menu icon", () => {
  const saved: Icon = { source: "library", id: "cookie" };

  function renderSettings(page: PageAdmin, submits: PageSettingsSubmit[]) {
    return renderWithProviders(
      <PageSettingsDialog
        open
        page={page}
        onCancel={() => undefined}
        onSave={(b) => submits.push(b)}
      />,
      { userManager: um }
    );
  }

  it("sets an icon on a page without one", async () => {
    const user = userEvent.setup();
    const submits: PageSettingsSubmit[] = [];
    renderSettings(f.pageAdmin[1]!, submits);
    await pickCookie(user);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(submits[0]?.icon).toEqual(saved);
  });

  it("clears a saved icon and sends null", async () => {
    const user = userEvent.setup();
    const submits: PageSettingsSubmit[] = [];
    renderSettings({ ...f.pageAdmin[1]!, icon: saved }, submits);
    const field = screen.getByTestId("page-icon-field");
    expect(await within(field).findByTestId("icon-preview-image")).toBeInTheDocument();
    await user.click(within(field).getByRole("button", { name: "Clear" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(submits[0]?.icon).toBeNull();
  });

  it("edits a saved icon, keeping its display", async () => {
    const user = userEvent.setup();
    const submits: PageSettingsSubmit[] = [];
    const media: Icon = {
      source: "media",
      id: f.mediaAssets[0]!.id as string,
      display: { sizePx: 24 },
    } as Icon;
    renderSettings({ ...f.pageAdmin[1]!, icon: media }, submits);
    await pickCookie(user);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(submits[0]?.icon).toEqual({ ...saved, display: { sizePx: 24 } });
  });

  it("a saved icon reads back and saves unchanged", async () => {
    const user = userEvent.setup();
    const submits: PageSettingsSubmit[] = [];
    const first = renderSettings(f.pageAdmin[1]!, submits);
    await pickCookie(user);
    await user.click(screen.getByRole("button", { name: "Save" }));
    first.unmount();

    // The page as the API returns it after the save.
    renderSettings({ ...f.pageAdmin[1]!, icon: submits[0]!.icon }, submits);
    const field = screen.getByTestId("page-icon-field");
    expect(await within(field).findByTestId("icon-preview-image")).toHaveAttribute(
      "alt",
      "Cookie"
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(submits[1]?.icon).toEqual(saved);
  });
});
