import { apiClient, ApiError } from "../../services/api-client";
import type { AuthUser, GoogleLoginResponse } from "./auth.types";

// API-USR-001
export function googleLogin(authorizationCode: string): Promise<GoogleLoginResponse> {
  return apiClient.post<GoogleLoginResponse>("/auth/google/login", { authorizationCode });
}

// API-USR-002
export function getCurrentUser(accessToken: string): Promise<AuthUser> {
  return apiClient.get<AuthUser>("/users/me", accessToken);
}

// API-USR-003
export function logout(accessToken: string): Promise<void> {
  return apiClient.post<void>("/auth/logout", undefined, accessToken);
}

export { ApiError };
