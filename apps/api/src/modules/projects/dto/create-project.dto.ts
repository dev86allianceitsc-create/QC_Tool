import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateProjectDto {
  @ApiProperty({ description: "Project name (duplicates allowed)", maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  projectName!: string;

  @ApiPropertyOptional({ description: "Project description" })
  @IsOptional()
  @IsString()
  description?: string;
}
