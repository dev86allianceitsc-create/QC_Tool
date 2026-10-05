import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthenticationController } from "./authentication.controller";
import { AuthenticationService } from "./authentication.service";
import { TestAccountController } from "./test-account.controller";
import { TestAccountService } from "./test-account.service";

@Module({
  imports: [AuditModule],
  controllers: [AuthenticationController, TestAccountController],
  providers: [AuthenticationService, TestAccountService],
})
export class AuthenticationModule {}
