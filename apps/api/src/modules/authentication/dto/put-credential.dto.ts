import { IsOptional, IsString, MaxLength } from "class-validator";

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
}
