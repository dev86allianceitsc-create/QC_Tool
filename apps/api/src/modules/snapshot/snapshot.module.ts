import { Module } from "@nestjs/common";

import { AuditModule } from "../audit/audit.module";
import { SnapshotController } from "./snapshot.controller";
import { SnapshotQueryService } from "./snapshot-query.service";
import { SnapshotService } from "./snapshot.service";

// Group 5 Snapshot (REQ-SNP-001..008): SnapshotService is exported so
// RunModule can inject it into RunExecutionEngine without duplicating the
// save/attempt-logging path, same pattern as AuditModule/AuditWriterService.
// SnapshotQueryService (List/Detail/Content/Invalidate, API-SNP-001..004) is
// a separate provider so the already-frozen write path is never touched.
@Module({
  imports: [AuditModule],
  controllers: [SnapshotController],
  providers: [SnapshotService, SnapshotQueryService],
  exports: [SnapshotService],
})
export class SnapshotModule {}
