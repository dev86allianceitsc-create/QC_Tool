import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export const AUTH_TYPE_VALUES = ["NONE", "LOGIN_FORM", "BEARER_TOKEN"] as const;
export type AuthTypeValue = (typeof AUTH_TYPE_VALUES)[number];

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class PutAuthenticationConfigurationDto {
  @IsIn(AUTH_TYPE_VALUES)
  authType!: AuthTypeValue;

  // Required only when authType = LOGIN_FORM; validated against that
  // business rule in the service, not here, since class-validator has no
  // clean way to express "required iff sibling field equals X".
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Transform(trim)
  loginUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(trim)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  usernameField?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(trim)
  passwordField?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trim)
  tokenResponsePath?: string;
}
