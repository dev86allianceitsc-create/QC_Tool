import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ProjectAccessGuard } from "../../common/guards/project-access.guard";
import { SessionGuard } from "../../common/guards/session.guard";

import {
  ComparisonAvailabilityResult,
  ComparisonPagedResult,
  ComparisonQueryService,
  ComparisonSummaryDto,
  CreateComparisonResult,
} from "./comparison-query.service";
import { CreateComparisonDto } from "./dto/create-comparison.dto";
import { ListComparisonsQueryDto } from "./dto/list-comparisons-query.dto";

// API-CMP-001/003 (AnD API v0.2 §3/§4). Project-scoped create+list — the
// permission matrix for both routes is the caller's membership in the path
// Project, enforced by ProjectAccessGuard exactly like every other
// Project-scoped resource in this repo.
@ApiTags("comparisons")
@Controller("projects/:projectId/comparisons")
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class ProjectComparisonsController {
  constructor(private readonly comparisonQueryService: ComparisonQueryService) {}

  @Post()
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({
    operationId: "createComparison",
    summary: "Create a Comparison for an explicit Snapshot pair, or resolve one from the current baseline and latest Snapshot (API-CMP-001)",
  })
  @ApiResponse({
    status: 201,
    description: "Comparison created and its first attempt QUEUED for processing (or immediately BLOCKED if the pair fails the eligibility gate). Location header points at the new Comparison.",
    schema: { example: { comparisonId: "b1f8e6d2-...", comparisonAttemptId: "9c2a7e11-...", processingStatus: "QUEUED" } },
  })
  @ApiResponse({
    status: 200,
    description: "selectionMode=BASELINE_LATEST could not construct a pair. No Comparison is created and Execution is not written to.",
    schema: {
      examples: {
        noLatestSnapshot: { value: { comparisonId: null, availabilityReasonCode: "NO_LATEST_SNAPSHOT", latestSnapshotId: null } },
        noBaseline: { value: { comparisonId: null, availabilityReasonCode: "NO_BASELINE", latestSnapshotId: "c4d1..." } },
        baselineInvalidated: { value: { comparisonId: null, availabilityReasonCode: "BASELINE_INVALIDATED", latestSnapshotId: "c4d1..." } },
      },
    },
  })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR — malformed DTO, or fields from the other selectionMode branch were supplied" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND — Project, or either Snapshot in a PAIR request, does not exist or is not visible to the caller" })
  @ApiResponse({ status: 422, description: "SEMANTIC_VALIDATION_ERROR — duplicate baselineSnapshotId/targetSnapshotId, or baselineSnapshotId does not belong to the path Project" })
  async create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateComparisonDto,
    @CurrentUser() actorUserId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CreateComparisonResult | ComparisonAvailabilityResult> {
    const result = await this.comparisonQueryService.createComparison(projectId, dto, actorUserId);
    if ("comparisonAttemptId" in result) {
      res.status(201).header("Location", `/api/v1/comparisons/${result.comparisonId}`);
    } else {
      res.status(200);
    }
    return result;
  }

  @Get()
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "listComparisons", summary: "List Comparisons for a Project, filterable by API/Snapshot/Execution/sourceKind/status/result (API-CMP-003)" })
  @ApiResponse({ status: 200, description: "Paged Comparison summary list" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async list(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query() query: ListComparisonsQueryDto,
  ): Promise<ComparisonPagedResult<ComparisonSummaryDto>> {
    return this.comparisonQueryService.listComparisons(projectId, query);
  }
}
