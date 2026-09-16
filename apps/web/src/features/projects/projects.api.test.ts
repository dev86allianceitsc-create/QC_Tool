import { afterEach, describe, expect, it, vi } from "vitest";
import { mockJsonResponse } from "../../test/mock-fetch";
import {
  addProjectMember,
  createProject,
  deleteProject,
  getProject,
  listProjectMembers,
  listProjects,
  removeProjectMember,
  updateProject,
} from "./projects.api";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(body?: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue(mockJsonResponse(status, body));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("projects.api", () => {
  it("listProjects sends page/pageSize/search/status/sortBy/sortOrder as query params", async () => {
    const fetchMock = stubFetch({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });

    await listProjects(
      { page: 2, pageSize: 20, search: "acme", status: "ACTIVE", sortBy: "projectName", sortOrder: "asc" },
      "token-1",
    );

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects?");
    expect(String(url)).toContain("page=2");
    expect(String(url)).toContain("pageSize=20");
    expect(String(url)).toContain("search=acme");
    expect(String(url)).toContain("status=ACTIVE");
    expect(String(url)).toContain("sortBy=projectName");
    expect(String(url)).toContain("sortOrder=asc");
  });

  it("createProject POSTs to /projects with projectName/description", async () => {
    const fetchMock = stubFetch({ projectId: "p1", projectName: "X", description: null, projectStatus: "ACTIVE", createdAt: "t", updatedAt: "t" }, 201);

    await createProject({ projectName: "X", description: "d" }, "token-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ projectName: "X", description: "d" }));
  });

  it("getProject GETs /projects/:projectId", async () => {
    const fetchMock = stubFetch({ projectId: "p1", projectName: "X", description: null, projectStatus: "ACTIVE", createdAt: "t", updatedAt: "t" });

    await getProject("p1", "token-1");

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1");
  });

  it("updateProject PATCHes /projects/:projectId with only the given fields", async () => {
    const fetchMock = stubFetch({ projectId: "p1", projectName: "Y", description: null, projectStatus: "INACTIVE", createdAt: "t", updatedAt: "t" });

    await updateProject("p1", { projectStatus: "INACTIVE" }, "token-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ projectStatus: "INACTIVE" }));
  });

  it("deleteProject DELETEs /projects/:projectId", async () => {
    const fetchMock = stubFetch(undefined, 204);

    await deleteProject("p1", "token-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1");
    expect(init.method).toBe("DELETE");
  });

  it("listProjectMembers sends page/pageSize/search/accountStatus as query params", async () => {
    const fetchMock = stubFetch({ items: [], page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });

    await listProjectMembers("p1", { page: 1, pageSize: 20, search: "a@b.com", accountStatus: "ACTIVE" }, "token-1");

    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/members?");
    expect(String(url)).toContain("search=a%40b.com");
    expect(String(url)).toContain("accountStatus=ACTIVE");
  });

  it("addProjectMember POSTs /projects/:projectId/members with the email", async () => {
    const fetchMock = stubFetch({ userId: "u1", email: "x@example.com", systemRole: "USER", accountStatus: "INVITED" }, 201);

    await addProjectMember("p1", "x@example.com", "token-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/members");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ email: "x@example.com" }));
  });

  it("removeProjectMember DELETEs /projects/:projectId/members/:userId", async () => {
    const fetchMock = stubFetch(undefined, 204);

    await removeProjectMember("p1", "u1", "token-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/projects/p1/members/u1");
    expect(init.method).toBe("DELETE");
  });
});
