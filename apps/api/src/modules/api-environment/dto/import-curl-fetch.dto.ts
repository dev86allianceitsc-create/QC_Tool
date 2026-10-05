import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsArray, IsDefined, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf, ValidateNested } from "class-validator";
import { RequestBodyDefinitionDto, RequestInputParameterDto } from "./put-request-input.dto";

const trim = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);
const trimUpper = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toUpperCase() : value);

// Phase 2 (customer feedback #1) importApiFromCurlFetch. Parsing of the
// pasted curl/fetch text happens client-side (see curlFetchImport.util.ts);
// this DTO is the already-user-reviewed result, so its field shapes and
// decorators intentionally mirror CreateApiDto (apiName/httpMethod/path/
// description) plus PutRequestInputDto's nested parameter/body DTOs
// (queryParameters/headerParameters/requestBody) — one atomic call creates
// both the API core row and its Request Input in a single transaction.
export class ImportCurlFetchDto {
  @ApiProperty({ maxLength: 255 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  apiName!: string;

  @ApiProperty({ maxLength: 10, description: "Trimmed and uppercased before validation" })
  @Transform(trimUpper)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  httpMethod!: string;

  @ApiProperty({ maxLength: 2048, description: "Must start with /" })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  @Matches(/^\//, { message: "path must start with /" })
  path!: string;

  @ApiPropertyOptional({ nullable: true })
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ type: [RequestInputParameterDto], description: "Suggested QUERY definitions detected from the parsed request" })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestInputParameterDto)
  queryParameters!: RequestInputParameterDto[];

  @ApiProperty({ type: [RequestInputParameterDto], description: "Suggested normal HEADER definitions detected from the parsed request" })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequestInputParameterDto)
  headerParameters!: RequestInputParameterDto[];

  @ApiPropertyOptional({ type: RequestBodyDefinitionDto, nullable: true, description: "null means no Request Body detected/included" })
  @ValidateIf((_, value) => value !== null)
  @IsDefined()
  @ValidateNested()
  @Type(() => RequestBodyDefinitionDto)
  requestBody!: RequestBodyDefinitionDto | null;
}
