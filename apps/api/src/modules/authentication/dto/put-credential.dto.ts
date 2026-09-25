import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

// Secret Credential Value input (REQ-SEC-002 §14). Exactly one of the two
// fields is meaningful, depending on the Authentication Configuration's
// current auth_type — the service rejects the mismatched one. Never logged,
// never echoed back; validated for presence/shape only, no upper bound tied
// to a specific auth scheme beyond a generous sanity cap.
export class PutCredentialDto {
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  token?: string;

  // BEARER_TOKEN only (Group 5 Q5 answer). An opaque bearer token cannot be
  // inspected to tell whether a replacement carries the same identity/access
  // as the old one, so a token replacement defaults to "new context"
  // (increments authentication_configurations.context_version) unless the
  // config owner explicitly confirms this is only a same-identity rotation.
  // Ignored for LOGIN_FORM, where identity is the stored username and this
  // endpoint cannot change it.
  @IsOptional()
  @IsBoolean()
  sameIdentity?: boolean;
}
