import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

// API-APIENV-002 putApiEnvironmentConfig. Only basic
// non-empty/length validation happens here (-> 400 VALIDATION_ERROR on
// failure); the absolute-HTTP/HTTPS-URL semantic check is deliberately done
// in the service so a syntactically-not-a-URL value and a parseable-but-
// wrong-scheme value can surface as the two distinct frozen error codes
// (400 VALIDATION_ERROR vs 422 SEMANTIC_VALIDATION_ERROR).
export class PutApiEnvironmentConfigDto {
  @ApiProperty({ maxLength: 4096, description: "Absolute HTTP/HTTPS URL" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  fullUrl!: string;
}
