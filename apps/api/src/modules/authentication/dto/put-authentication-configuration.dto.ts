import { Transform, Type } from "class-transformer";
import { IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";

export const AUTH_TYPE_VALUES = ["NONE", "LOGIN_FORM", "BEARER_TOKEN"] as const;
export type AuthTypeValue = (typeof AUTH_TYPE_VALUES)[number];

export const LOGIN_MODE_VALUES = ["MANUAL", "IMPORTED"] as const;
export type LoginModeValue = (typeof LOGIN_MODE_VALUES)[number];

export const IMPORT_BODY_FORMAT_VALUES = ["JSON", "FORM_URLENCODED", "NONE"] as const;
export type ImportBodyFormatValue = (typeof IMPORT_BODY_FORMAT_VALUES)[number];

export const FIELD_LOCATION_KIND_VALUES = ["HEADER", "BODY"] as const;
export type FieldLocationKindValue = (typeof FIELD_LOCATION_KIND_VALUES)[number];

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class KeyValueEntryDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(2048)
  value!: string;
}

export class FieldLocationDto {
  @IsIn(FIELD_LOCATION_KIND_VALUES)
  kind!: FieldLocationKindValue;

  @IsString()
  @MaxLength(200)
  name!: string;
}

export class PutAuthenticationConfigurationDto {
  @IsIn(AUTH_TYPE_VALUES)
  authType!: AuthTypeValue;

  // Everything below is required only for specific authType/loginMode
  // combinations; validated against those business rules in the service,
  // not here, since class-validator has no clean way to express "required
  // iff sibling field equals X".

  @IsOptional()
  @IsIn(LOGIN_MODE_VALUES)
  loginMode?: LoginModeValue;

  // MANUAL shape.
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Transform(trim)
  loginUrl?: string;

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

  // IMPORTED shape.
  @IsOptional()
  @IsString()
  @MaxLength(10)
  importMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @Transform(trim)
  importUrl?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KeyValueEntryDto)
  importHeaders?: KeyValueEntryDto[];

  @IsOptional()
  @IsIn(IMPORT_BODY_FORMAT_VALUES)
  importBodyFormat?: ImportBodyFormatValue;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KeyValueEntryDto)
  importBodyFields?: KeyValueEntryDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FieldLocationDto)
  importUsernameLocation?: FieldLocationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FieldLocationDto)
  importPasswordLocation?: FieldLocationDto;
}
