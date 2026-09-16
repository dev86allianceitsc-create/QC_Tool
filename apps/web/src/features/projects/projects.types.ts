// Mirrors the current backend contract exactly (API-PRJ-001..008).

export type Role = "ADMIN" | "USER";
export type MemberStatus = "ACTIVE" | "INVITED" | "INACTIVE" | "BLOCKED";
export type ProjectStatus = "ACTIVE" | "INACTIVE";

export interface ProjectListItem {
  projectId: string;
  projectName: string;
  description: string | null;
  projectStatus: ProjectStatus;
}

export interface ProjectDetail extends ProjectListItem {
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMemberView {
  userId: string;
  email: string;
  systemRole: Role;
  accountStatus: MemberStatus;
}
