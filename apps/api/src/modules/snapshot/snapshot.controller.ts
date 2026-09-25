import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ProjectAccessGuard } from "../../common/guards/project-access.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { InvalidateSnapshotDto } from "./dto/invalidate-snapshot.dto";
import { ListSnapshotsQueryDto } from "./dto/list-snapshots-query.dto";
import { InvalidateSnapshotResult, ListSnapshotsResult, SnapshotDetail, SnapshotQueryService } from "./snapshot-query.service";

// Group 5 Snapshot read/mutation API surface (API-SNP-001..004). Out of
// scope, deliberately never added here: creating/editing/deleting Snapshot
// content, restore, baseline selection, or Comparison.
@ApiTags("snapshots")
@Controller("projects/:projectId/snapshots")
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class SnapshotController {
  constructor(private readonly snapshotQueryService: SnapshotQueryService) {}

  @Get()
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "listSnapshots", summary: "List Snapshots for a Project, with a Project-wide API grouping (API-SNP-001)" })
  @ApiResponse({ status: 200, description: "Paged Snapshot list plus Project-wide apiGroups" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 422, description: "SEMANTIC_VALIDATION_ERROR" })
  async list(@Param("projectId", ParseUUIDPipe) projectId: string, @Query() query: ListSnapshotsQueryDto): Promise<ListSnapshotsResult> {
    return this.snapshotQueryService.listSnapshots(projectId, query);
  }

  @Get(":snapshotId")
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "getSnapshot", summary: "Get Snapshot detail (API-SNP-002)" })
  @ApiResponse({ status: 200, description: "Snapshot detail" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async getOne(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("snapshotId", ParseUUIDPipe) snapshotId: string,
  ): Promise<SnapshotDetail> {
    return this.snapshotQueryService.getSnapshot(projectId, snapshotId);
  }

  // Raw-byte response — never wraps the body in JSON/base64 (AnD API
  // §5.2/5.3). 204 with no body when the part was never captured; 200 with
  // the exact stored bytes and Content-Type otherwise.
  @Get(":snapshotId/contents/:bodyPart")
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "getSnapshotContent", summary: "Get raw request/response body bytes for a Snapshot (API-SNP-003)" })
  @ApiResponse({ status: 200, description: "Raw body bytes, Content-Type set from the stored value" })
  @ApiResponse({ status: 204, description: "Body part was never captured for this Snapshot" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async getContent(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("snapshotId", ParseUUIDPipe) snapshotId: string,
    @Param("bodyPart") bodyPart: string,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.snapshotQueryService.getSnapshotContent(projectId, snapshotId, bodyPart);
    if (!result.present || !result.buffer) {
      res.status(HttpStatus.NO_CONTENT).end();
      return;
    }
    res.status(HttpStatus.OK).setHeader("Content-Type", result.contentType ?? "application/octet-stream").send(result.buffer);
  }

  @Post(":snapshotId/invalidations")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @ApiOperation({ operationId: "invalidateSnapshot", summary: "Invalidate a Snapshot with a reason — Admin only (API-SNP-004)" })
  @ApiResponse({ status: 201, description: "Snapshot invalidated" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ACCESS_DENIED / ROLE_NOT_ASSIGNED / INVALID_SYSTEM_ROLE" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "INVALID_STATE / SNAPSHOT_ALREADY_INVALIDATED" })
  @HttpCode(HttpStatus.CREATED)
  async invalidate(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("snapshotId", ParseUUIDPipe) snapshotId: string,
    @Body() dto: InvalidateSnapshotDto,
    @CurrentUser() userId: string,
  ): Promise<InvalidateSnapshotResult> {
    return this.snapshotQueryService.invalidateSnapshot(projectId, snapshotId, dto.reason, userId);
  }
}
