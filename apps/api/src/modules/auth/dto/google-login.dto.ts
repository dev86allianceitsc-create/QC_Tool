import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class GoogleLoginDto {
  @ApiProperty({ description: "Authorization code obtained by the frontend via Google's Authorization Code Flow + PKCE" })
  @IsString()
  @IsNotEmpty()
  authorizationCode!: string;
}
