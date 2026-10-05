import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { IgnoreRulesService } from "./ignore-rules.service";
import { ProjectIgnoreRulesController } from "./project-ignore-rules.controller";

// Output Ignore Rules (spec: Project Settings management + the View
// Differences bulk-create flow). IgnoreRulesService is exported so
// ComparisonModule can inject it into ComparisonEngineService's OUTPUT
// stage — same AuditModule/export wiring SnapshotModule and ComparisonModule
// themselves use.
@Module({
  imports: [AuditModule],
  controllers: [ProjectIgnoreRulesController],
  providers: [IgnoreRulesService],
  exports: [IgnoreRulesService],
})
export class IgnoreRulesModule {}
