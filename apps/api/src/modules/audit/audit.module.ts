import { Module } from "@nestjs/common";
import { AuditController } from "./audit.controller";
import { AuditQueryService } from "./audit-query.service";
import { AuditWriterService } from "./audit-writer.service";

// The common audit writer (REQ-SEC-001): AuditWriterService is exported so
// other modules (e.g. ProjectsModule) can inject it to record audit events
// for their own mutations without duplicating the write path.
@Module({
  controllers: [AuditController],
  providers: [AuditWriterService, AuditQueryService],
  exports: [AuditWriterService],
})
export class AuditModule {}
