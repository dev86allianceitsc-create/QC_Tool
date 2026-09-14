import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { GoogleIdentityService } from "./google-identity.service";

@Module({
  controllers: [AuthController],
  providers: [AuthService, GoogleIdentityService],
})
export class AuthModule {}
