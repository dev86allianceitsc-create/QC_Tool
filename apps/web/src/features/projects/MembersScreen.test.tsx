import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../../test/mock-fetch";
import { MembersScreen } from "./MembersScreen";

const MEMBERS_PAGE = {
  items: [
    { userId: "m1", email: "active@example.com", systemRole: "USER", accountStatus: "ACTIVE" },
    { userId: "m2", email: "invited@example.com", systemRole: "USER", accountStatus: "INVITED" },
  ],
  page: 1,
  pageSize: 100,
  totalItems: 2,
  totalPages: 1,
};

const ADMIN = { email: "admin@example.com", role: "ADMIN" as const };
const USER = { email: "user@example.com", role: "USER" as const };

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(response: Response = mockJsonResponse(200, MEMBERS_PAGE)) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderScreen(user: typeof ADMIN | typeof USER) {
  return render(
    <MembersScreen
      user={user}
      projectId="p1"
      projectName="Project A"
      accessToken="token-1"
      onSessionExpired={vi.fn()}
      onAccessDenied={vi.fn()}
    />,
  );
}

describe("MembersScreen", () => {
  it("shows Add Member and row actions for ADMIN, with no Cancel Invitation action", async () => {
    stubFetch();
    renderScreen(ADMIN);
    await screen.findByText("active@example.com");
    expect(screen.getByText("+ Add Member")).toBeInTheDocument();
    expect(screen.getAllByText("Remove from Project").length).toBe(2);
    expect(screen.getByText("Edit Invitation")).toBeInTheDocument();
    expect(screen.queryByText("Cancel Invitation")).not.toBeInTheDocument();
  });

  it("hides Add Member and row actions for USER", async () => {
    stubFetch();
    renderScreen(USER);
    await screen.findByText("active@example.com");
    expect(screen.queryByText("+ Add Member")).not.toBeInTheDocument();
    expect(screen.queryByText("Remove from Project")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit Invitation")).not.toBeInTheDocument();
  });

  it("names the project and member in the Remove from Project confirmation", async () => {
    stubFetch();
    renderScreen(ADMIN);
    await screen.findByText("active@example.com");
    fireEvent.click(screen.getAllByText("Remove from Project")[0]);
    expect(
      screen.getByText((_, node) => node?.textContent === 'Remove active@example.com from "Project A"? This only removes their access to this Project — it does not delete their account, change their System Role, or remove them from other Projects.'),
    ).toBeInTheDocument();
  });

  it("removes a member via DELETE then refetches", async () => {
    const fetchMock = stubFetch();
    renderScreen(ADMIN);
    await screen.findByText("active@example.com");

    fetchMock.mockResolvedValueOnce(mockJsonResponse(204, undefined));
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { ...MEMBERS_PAGE, items: [MEMBERS_PAGE.items[1]] }));

    fireEvent.click(screen.getAllByText("Remove from Project")[0]);
    fireEvent.click(screen.getByText("Remove"));

    await waitFor(() => expect(screen.queryByText("active@example.com")).not.toBeInTheDocument());
    const [, deleteInit] = fetchMock.mock.calls[1];
    expect(deleteInit.method).toBe("DELETE");
  });

  it("adds a member via POST, mapping 409 to duplicate and 422 to blocked", async () => {
    const fetchMock = stubFetch();
    renderScreen(ADMIN);
    await screen.findByText("active@example.com");

    fetchMock.mockResolvedValueOnce(mockJsonResponse(409, { errorCode: "CONFLICT", message: "dup", details: [], requestId: "r1" }));
    fireEvent.click(screen.getByText("+ Add Member"));
    fireEvent.change(screen.getByPlaceholderText("user@example.com"), { target: { value: "dup@example.com" } });
    fireEvent.click(screen.getByText("Add Member", { selector: "button" }));
    expect(await screen.findByText("User already belongs to this project")).toBeInTheDocument();
  });

  it("edits an invitation email via API-USR-005 then refetches", async () => {
    const fetchMock = stubFetch();
    renderScreen(ADMIN);
    await screen.findByText("invited@example.com");

    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { userId: "m2", email: "new@example.com", accountStatus: "INVITED" }));
    fetchMock.mockResolvedValueOnce(mockJsonResponse(200, { ...MEMBERS_PAGE, items: [MEMBERS_PAGE.items[0], { userId: "m2", email: "new@example.com", systemRole: "USER", accountStatus: "INVITED" }] }));

    fireEvent.click(screen.getByText("Edit Invitation"));
    fireEvent.change(screen.getByDisplayValue("invited@example.com"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByText("Save"));

    await screen.findByText("new@example.com");
    const [url, patchInit] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/users/m2");
    expect(patchInit.method).toBe("PATCH");
  });

  it("maps ACCOUNT_NOT_INVITED to an inline error on edit invitation", async () => {
    const fetchMock = stubFetch();
    renderScreen(ADMIN);
    await screen.findByText("invited@example.com");

    fetchMock.mockResolvedValueOnce(mockJsonResponse(409, { errorCode: "ACCOUNT_NOT_INVITED", message: "no longer invited", details: [], requestId: "r1" }));

    fireEvent.click(screen.getByText("Edit Invitation"));
    fireEvent.change(screen.getByDisplayValue("invited@example.com"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByText("Save"));

    expect(await screen.findByText("This invitation can no longer be edited")).toBeInTheDocument();
  });
});
