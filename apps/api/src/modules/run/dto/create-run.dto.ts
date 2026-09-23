import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
  registerDecorator,
  type ValidationOptions,
} from "class-validator";

import { MAX_BATCH_EXECUTIONS } from "../run.constants";

export const RUN_TYPE_VALUES = ["SINGLE", "BATCH"] as const;
export type RunType = (typeof RUN_TYPE_VALUES)[number];

function IsStringRecord(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isStringRecord",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== "object" || value === null || Array.isArray(value)) {
            return false;
          }
          return Object.values(value as Record<string, unknown>).every((v) => typeof v === "string");
        },
        defaultMessage(): string {
          return `${propertyName} must be an object whose values are all strings`;
        },
      },
    });
  };
}

// Mirrors the frontend's ephemeral RunRequestValues shape
// (apps/web/src/features/apiEnvironment/requestInput.types.ts). Never
// persisted as-is — only the redacted actual-request trace is stored
// (REQ-RUN-008 RS-008-15).
export class RequestValuesDto {
  @ApiPropertyOptional({ type: Object, description: "Values for {token} path parameters, keyed by name" })
  @IsOptional()
  @IsStringRecord()
  pathValues?: Record<string, string> = {};

  @ApiPropertyOptional({ type: Object, description: "Values for query parameters, keyed by name" })
  @IsOptional()
  @IsStringRecord()
  queryValues?: Record<string, string> = {};

  @ApiPropertyOptional({ type: Object, description: "Values for custom header parameters, keyed by name" })
  @IsOptional()
  @IsStringRecord()
  headerValues?: Record<string, string> = {};

  @ApiPropertyOptional({ description: "Raw request body text (JSON), empty string when not applicable" })
  @IsOptional()
  @IsString()
  bodyValue?: string = "";
}

export class RunExecutionInputDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  apiId!: string;

  @ApiProperty({ type: RequestValuesDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => RequestValuesDto)
  requestValues!: RequestValuesDto;

  // Manual override; falls back to UNKNOWN when absent (no "configured
  // version" concept exists elsewhere in the schema — see progress doc).
  @ApiPropertyOptional({ maxLength: 100, description: "Manual API version label; UNKNOWN when omitted" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  apiVersion?: string;

  @ApiPropertyOptional({ maxLength: 100, description: "Manual database version label; UNKNOWN when omitted" })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  databaseVersion?: string;
}

export class CreateRunDto {
  @ApiProperty({ enum: RUN_TYPE_VALUES })
  @IsIn(RUN_TYPE_VALUES)
  runType!: RunType;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  environmentId!: string;

  @ApiProperty({ type: [RunExecutionInputDto], minItems: 1, maxItems: MAX_BATCH_EXECUTIONS })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BATCH_EXECUTIONS)
  @ValidateNested({ each: true })
  @Type(() => RunExecutionInputDto)
  executions!: RunExecutionInputDto[];
}
