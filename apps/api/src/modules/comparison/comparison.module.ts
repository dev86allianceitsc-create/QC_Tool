import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ComparisonChainAccessGuard } from "./comparison-chain-access.guard";
import { ComparisonAccessGuard } from "./comparison-access.guard";
import { ComparisonEngineService } from "./comparison-engine.service";
import { ComparisonQueryService } from "./comparison-query.service";
import { ComparisonService } from "./comparison.service";
import { ComparisonChainsController } from "./comparison-chains.controller";
import { ComparisonsController } from "./comparisons.controller";
import { ProjectComparisonChainsController } from "./project-comparison-chains.controller";
import { ProjectComparisonsController } from "./project-comparisons.controller";

// Group 6/7 Comparison (REQ-CMP-001..018): ComparisonService and
// ComparisonEngineService are exported so RunModule can inject them into
// RunExecutionEngine for automatic Comparison creation and processing, same
// pattern as SnapshotModule/AuditModule. ComparisonQueryService (the
// API-CMP-001..010 request-shape layer: permission pre-checks, 400/404/422
// branching, response mapping) is NOT exported, matching
// SnapshotQueryService's own module — nothing outside this module talks to
// the Comparison API surface directly. AuditModule is imported (not just
// AuditWriterService injected ad hoc) so both ComparisonService and
// ComparisonQueryService can record audit events, same wiring RunModule uses.
@Module({
  imports: [AuditModule],
  controllers: [ProjectComparisonsController, ProjectComparisonChainsController, ComparisonsController, ComparisonChainsController],
  providers: [ComparisonService, ComparisonEngineService, ComparisonQueryService, ComparisonAccessGuard, ComparisonChainAccessGuard],
  exports: [ComparisonService, ComparisonEngineService],
})
export class ComparisonModule {}
