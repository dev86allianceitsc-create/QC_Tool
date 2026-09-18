import { HttpStatus } from "@nestjs/common";
import { BusinessException } from "../../common/exceptions/business.exception";

// REQ-INP-002 (Group 3B) — MVP supported-method allowlist. A method string
// that is well-formed but outside this set is a business/domain rule
// violation (422), not a malformed request shape (400) — see the 3B FINAL
// FROZEN API Contract §14/§15 error-contract boundary. This is why the
// allowlist is enforced here in the service layer rather than via a
// class-validator @IsIn() on the DTO, which would surface as 400.
export const SUPPORTED_HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type SupportedHttpMethod = (typeof SUPPORTED_HTTP_METHODS)[number];

const SUPPORTED_HTTP_METHOD_SET: ReadonlySet<string> = new Set(SUPPORTED_HTTP_METHODS);

export function isSupportedHttpMethod(method: string): boolean {
  return SUPPORTED_HTTP_METHOD_SET.has(method);
}

export function assertSupportedHttpMethod(method: string): void {
  if (!isSupportedHttpMethod(method)) {
    throw new BusinessException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      "SEMANTIC_VALIDATION_ERROR",
      `Unsupported HTTP Method '${method}'. Supported methods are GET, POST, PUT, PATCH, DELETE.`,
    );
  }
}
