import { Module } from "@nestjs/common";
import { ComparisonService } from "./comparison.service";

// Group 6/7 Comparison (REQ-CMP-001..018): ComparisonService is exported so
// RunModule can inject it into RunExecutionEngine for automatic Comparison
// creation, same pattern as SnapshotModule/AuditModule.
@Module({
  providers: [ComparisonService],
  exports: [ComparisonService],
})
export class ComparisonModule {}
