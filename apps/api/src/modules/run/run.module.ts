import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ApiRunExecutionsController } from "./api-run-executions.controller";
import { RunExecutionEngine } from "./run-execution.engine";
import { RunsController } from "./runs.controller";
import { RunsService } from "./runs.service";

@Module({
  imports: [AuditModule],
  controllers: [RunsController, ApiRunExecutionsController],
  providers: [RunsService, RunExecutionEngine],
})
export class RunModule {}
