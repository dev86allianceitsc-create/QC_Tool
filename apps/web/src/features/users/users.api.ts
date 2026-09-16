import { apiClient } from "../../services/api-client";

export interface UpdatedInvitedUser {
  userId: string;
  email: string;
  accountStatus: string;
}

// API-USR-005: admin-only, email-only, target user must be INVITED
// (409 ACCOUNT_NOT_INVITED otherwise). Used by MembersScreen's "Edit
// Invitation" action — never for editing an already-ACTIVE member's email.
export function updateInvitedUserEmail(userId: string, email: string, accessToken: string): Promise<UpdatedInvitedUser> {
  return apiClient.patch<UpdatedInvitedUser>(`/users/${userId}`, { email }, accessToken);
}
