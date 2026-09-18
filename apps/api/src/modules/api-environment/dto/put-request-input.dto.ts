import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsArray, IsBoolean, IsDefined, IsIn, IsNotEmpty, IsString, MaxLength, ValidateIf, ValidateNested } from "class-validator";
import { MAX_PARAMETER_NAME_LENGTH, SUPPORTED_REQUEST_BODY_TYPES } from "../request-input-validation.util";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

// API-INP-002 putRequestInputDefinition — request field dictionary §6.1.
// Only name + required are accepted per parameter; the 3B FINAL FROZEN
// contract §6.2 explicitly excludes parameter/value/defaultValue/example/
// schema (advanced schema metadata is out of MVP scope per REQ-INP-003
// BR-INP-003-24). Global ValidationPipe (whitelist + forbidNonWhitelisted)
// rejects any of those fields with 400 automatically.
export class RequestInputParameterDto {
  @ApiProperty({ maxLength: MAX_PARAMETER_NAME_LENGTH })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PARAMETER_NAME_LENGTH)
  name!: string;

  @ApiProperty()
  @IsBoolean()
  required!: boolean;
}

// §6.1 requestBody.bodyType — MVP accepts JSON only; unsupported bodyType is
// a 422 semantic validation error (§8 Request Body Contract), enforced here
// via @IsIn so the DTO stays a pure "is this a supported literal" check
// while duplicate/reserved-name business rules remain in the service layer.
export class RequestBodyDefinitionDto {
  @ApiProperty({ enum: SUPPORTED_REQUEST_BODY_TYPES })
  @IsString()
  @IsIn(SUPPORTED_REQUEST_BODY_TYPES)
  bodyType!: (typeof SUPPORTED_REQUEST_BODY_TYPES)[number];
}

// DP-3B-API-02 (FROZEN): PUT is a full replacement. queryParameters and
// headerParameters are required (but may be empty []) arrays — omitting
// them is not accepted as "leave unchanged" (this is not a PATCH); @IsArray
// already rejects undefined. requestBody is required but nullable: null
// explicitly means "no Request Body configured", while omitting the field
// (undefined) must still fail validation. @ValidateNested alone silently
// skips validation when the value is undefined (class-validator only runs
// nested validation for values that are actually present), so @IsDefined()
// is required alongside it to reject an omitted field; @ValidateIf skips
// both when the value is exactly null, giving the required-but-nullable
// semantics from §6.1 without a bespoke decorator.
export class PutRequestInputDto {
  @ApiProperty({ type: [RequestInputParameterDto], description: "Full desired QUERY definition set; [] clears all Query definitions" })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestInputParameterDto)
  queryParameters!: RequestInputParameterDto[];

  @ApiProperty({ type: [RequestInputParameterDto], description: "Full desired normal HEADER definition set; [] clears all Header definitions" })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestInputParameterDto)
  headerParameters!: RequestInputParameterDto[];

  @ApiPropertyOptional({ type: RequestBodyDefinitionDto, nullable: true, description: "null removes the Body Definition" })
  @ValidateIf((_, value) => value !== null)
  @IsDefined()
  @ValidateNested()
  @Type(() => RequestBodyDefinitionDto)
  requestBody!: RequestBodyDefinitionDto | null;
}
