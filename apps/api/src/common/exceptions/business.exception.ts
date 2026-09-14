import { HttpException, HttpStatus } from "@nestjs/common";

// Carries an explicit business error code (e.g. ACCOUNT_INACTIVE,
// SESSION_EXPIRED) so AllExceptionsFilter can report it verbatim instead of
// falling back to its generic HTTP-status-keyed map — needed because several
// distinct business codes share the same HTTP status (e.g. 403 is used by
// ACCOUNT_INACTIVE, ACCOUNT_BLOCKED, INVALID_SYSTEM_ROLE, and
// ACCOUNT_NOT_ALLOWED alike).
export class BusinessException extends HttpException {
  constructor(status: HttpStatus, errorCode: string, message: string) {
    super({ errorCode, message }, status);
  }
}
