import { Controller, Get, Header, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { toCsv } from "../../common/utils/csv";
import { AuditQueryService, type AuditLogDetail, type AuditLogListItem, type PagedResult } from "./audit-query.service";
import { AuditLogFilterDto, ListAuditLogsQueryDto } from "./dto/list-audit-logs-query.dto";

const CSV_HEADERS = [
  "auditId",
  "eventType",
  "result",
  "occurredAt",
  "actorUserId",
  "actorDisplay",
  "targetType",
  "targetId",
  "targetDisplay",
  "projectId",
  "requestId",
  "detail",
];

function toCsvRow(entry: AuditLogDetail): unknown[] {
  return [
    entry.auditId,
    entry.eventType,
    entry.result,
    entry.occurredAt.toISOString(),
    entry.actorUserId ?? "",
    entry.actorDisplay ?? "",
    entry.targetType ?? "",
    entry.targetId ?? "",
    entry.targetDisplay ?? "",
    entry.projectId ?? "",
    entry.requestId ?? "",
    entry.detail ?? "",
  ];
}

@ApiTags("audit-logs")
@Controller("audit-logs")
@UseGuards(SessionGuard, RolesGuard)
@Roles("ADMIN")
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditQueryService: AuditQueryService) {}

  @Get()
  @ApiOperation({ operationId: "listAuditLogs", summary: "List/search/filter audit logs (API-SEC-001)" })
  @ApiResponse({ status: 200, description: "Paged audit log list" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ACCESS_DENIED / ROLE_NOT_ASSIGNED / INVALID_SYSTEM_ROLE" })
  async list(@Query() query: ListAuditLogsQueryDto): Promise<PagedResult<AuditLogListItem>> {
    return this.auditQueryService.list(query);
  }

  // Registered before ":auditId" so it is not shadowed by the UUID route.
  @Get("export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="audit-logs.csv"')
  @ApiOperation({ operationId: "exportAuditLogs", summary: "Export audit logs matching the same filters as list (API-SEC-003)" })
  @ApiResponse({ status: 200, description: "CSV file of the full matching result set" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ACCESS_DENIED / ROLE_NOT_ASSIGNED / INVALID_SYSTEM_ROLE" })
  async export(@Query() query: AuditLogFilterDto): Promise<string> {
    const rows = await this.auditQueryService.listAllForExport(query);
    return toCsv(CSV_HEADERS, rows.map(toCsvRow));
  }

  @Get(":auditId")
  @ApiOperation({ operationId: "getAuditLog", summary: "Get audit log detail (API-SEC-002)" })
  @ApiResponse({ status: 200, description: "Audit log detail" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ACCESS_DENIED / ROLE_NOT_ASSIGNED / INVALID_SYSTEM_ROLE" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async getOne(@Param("auditId", ParseUUIDPipe) auditId: string): Promise<AuditLogDetail> {
    return this.auditQueryService.getById(auditId);
  }
}
