// Shared with AuthService's Google-login flow (API-USR-001) so that first-time
// linking and any subsequent email edit (API-USR-005) normalize identically —
// a divergent normalization rule between the two would let the same
// human-intended address be treated as distinct users.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
