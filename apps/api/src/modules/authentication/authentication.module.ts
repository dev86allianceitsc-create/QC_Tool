import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthenticationController } from "./authentication.controller";
import { AuthenticationService } from "./authentication.service";

@Module({
  imports: [AuditModule],
  controllers: [AuthenticationController],
  providers: [AuthenticationService],
})
export class AuthenticationModule {}
