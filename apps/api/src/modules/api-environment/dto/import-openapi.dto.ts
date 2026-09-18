import { ApiProperty } from "@nestjs/swagger";
import { plainToInstance, Transform, Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsNotEmpty, IsString, ValidateNested } from "class-validator";

export class ImportOpenApiCandidateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  httpMethod!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  path!: string;
}

// A custom @Transform() on a property fully replaces class-transformer's
// normal handling of that property, INCLUDING the @Type()-driven nested
// class instantiation declared just below it — @Type() never runs on this
// property's value, only on whatever this function returns. Without this,
// parseJsonPart returned a plain array of plain objects (JSON.parse output),
// so class-validator's whitelist check for each array item ran against a
// plain Object instead of ImportOpenApiCandidateDto, which has no known
// properties — hence every valid field (httpMethod, path) was reported as
// "should not exist". Instantiating the nested DTO class here (still only
// httpMethod/path — the frozen contract's own shape) fixes that without
// touching the multipart contract or loosening whitelist/forbidNonWhitelisted.
function parseJsonPart({ value }: { value: unknown }): unknown {
  if (typeof value !== "string") return value;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    // Let @IsArray() below fail with a normal validation error rather than
    // throwing out of the pipeline.
    return undefined;
  }
  if (!Array.isArray(parsed)) {
    return parsed;
  }
  return parsed.map((item) => plainToInstance(ImportOpenApiCandidateDto, item));
}

// API-API-007 importOpenApiEndpoints. selectedCandidates arrives as a
// multipart JSON text part (a JSON-encoded array), so it must be parsed
// before class-validator can inspect it as an array of objects.
export class ImportOpenApiDto {
  @ApiProperty({ type: [ImportOpenApiCandidateDto], description: "Multipart JSON part: array of {httpMethod, path}" })
  @Transform(parseJsonPart)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportOpenApiCandidateDto)
  selectedCandidates!: ImportOpenApiCandidateDto[];
}
