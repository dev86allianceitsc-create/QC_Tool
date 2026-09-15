// App-local (not packages/shared-types) — Project/Member domain remains
// mocked and out of scope for a real backend contract in this milestone.
// See apps/api/src/modules/projects/projects.module.ts (empty shell) and
// prisma/schema.prisma (Project has no status/description/soft-delete column).

export type Role = "ADMIN" | "USER";
export type MemberStatus = "ACTIVE" | "INVITED" | "INACTIVE" | "BLOCKED";
export type ProjectStatus = "ACTIVE" | "INACTIVE";

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  // Soft-delete marker (mock-only). Never surfaced in normal list/detail UI.
  deletedAt: string | null;
}

export interface Member {
  id: string;
  email: string;
  role: Role;
  status: MemberStatus;
  addedAt: string;
}
