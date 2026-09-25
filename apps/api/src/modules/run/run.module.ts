import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ComparisonModule } from "../comparison/comparison.module";
import { SnapshotModule } from "../snapshot/snapshot.module";
import { ApiRunExecutionsController } from "./api-run-executions.controller";
import { RunExecutionEngine } from "./run-execution.engine";
import { RunsController } from "./runs.controller";
import { RunsService } from "./runs.service";

@Module({
  imports: [AuditModule, SnapshotModule, ComparisonModule],
  controllers: [RunsController, ApiRunExecutionsController],
  providers: [RunsService, RunExecutionEngine],
})
export class RunModule {}
