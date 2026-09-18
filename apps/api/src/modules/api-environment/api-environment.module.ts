import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ApiEnvironmentConfigsController } from "./api-environment-configs.controller";
import { ApiEnvironmentConfigsService } from "./api-environment-configs.service";
import { ApiImportsController } from "./api-imports.controller";
import { ApiImportsService } from "./api-imports.service";
import { ApisController } from "./apis.controller";
import { ApisService } from "./apis.service";
import { EnvironmentsController } from "./environments.controller";
import { EnvironmentsService } from "./environments.service";
import { RequestInputController } from "./request-input.controller";
import { RequestInputService } from "./request-input.service";

@Module({
  imports: [AuditModule],
  controllers: [ApisController, EnvironmentsController, ApiImportsController, ApiEnvironmentConfigsController, RequestInputController],
  providers: [ApisService, EnvironmentsService, ApiImportsService, ApiEnvironmentConfigsService, RequestInputService],
})
export class ApiEnvironmentModule {}
