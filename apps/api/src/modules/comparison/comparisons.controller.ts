import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { SessionGuard } from "../../common/guards/session.guard";

import { ComparisonAccessGuard } from "./comparison-access.guard";
import {
  ClassificationEventItemDto,
  ClassificationEventResultDto,
  ComparisonAttemptListItemDto,
  ComparisonDetailDto,
  ComparisonFindingsResult,
  ComparisonPagedResult,
  ComparisonQueryService,
  RetryComparisonResultDto,
} from "./comparison-query.service";
import { CreateClassificationEventDto } from "./dto/create-classification-event.dto";
import { ListComparisonFindingsQueryDto } from "./dto/list-comparison-findings-query.dto";

// API-CMP-004..007, 009, 010 (AnD API v0.2 §3/§4). No :projectId in these
// paths — ComparisonAccessGuard itself checks access to both Snapshot A's
// and Snapshot B's Project (REQ-CMP-016) and collapses any denial into the
// same 404 as "Comparison does not exist" (comparison-access.guard.ts).
@ApiTags("comparisons")
@Controller("comparisons")
@UseGuards(SessionGuard, ComparisonAccessGuard)
@ApiBearerAuth()
export class ComparisonsController {
  constructor(private readonly comparisonQueryService: ComparisonQueryService) {}

  @Get(":comparisonId")
  @ApiOperation({ operationId: "getComparison", summary: "Get Comparison detail — status, Result, classification, and version/latency deltas (API-CMP-004)" })
  @ApiResponse({
    status: 200,
    description: "Comparison detail. Terminal processingStatus values and their meaning are illustrated below.",
    schema: {
      examples: {
        blockedInputMismatch: { value: { processingStatus: "BLOCKED", stoppedAtGate: "INPUT", reasonCode: "INPUT_MISMATCH", result: null, outputDifferenceCount: null } },
        same: { value: { processingStatus: "COMPLETED", result: "SAME", outputDifferenceCount: 0 } },
        different: { value: { processingStatus: "COMPLETED", result: "DIFFERENT", outputDifferenceCount: 3 } },
        failed: { value: { processingStatus: "FAILED", stoppedAtGate: null, reasonCode: "ENGINE_ERROR", result: null, outputDifferenceCount: null } },
      },
    },
  })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async getOne(@Param("comparisonId", ParseUUIDPipe) comparisonId: string): Promise<ComparisonDetailDto> {
    return this.comparisonQueryService.getComparison(comparisonId);
  }

  @Get(":comparisonId/findings")
  @ApiOperation({ operationId: "listComparisonFindings", summary: "List findings for a Comparison's latest attempt, optionally filtered by phase (API-CMP-005)" })
  @ApiResponse({ status: 200, description: "Paged findings list; a and b sides never carry raw evidence bytes — see the separate raw-content contract" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async listFindings(
    @Param("comparisonId", ParseUUIDPipe) comparisonId: string,
    @Query() query: ListComparisonFindingsQueryDto,
  ): Promise<ComparisonFindingsResult> {
    return this.comparisonQueryService.listComparisonFindings(comparisonId, query);
  }

  @Get(":comparisonId/attempts")
  @ApiOperation({ operationId: "listComparisonAttempts", summary: "List every attempt ever made for a Comparison, oldest first (API-CMP-006)" })
  @ApiResponse({ status: 200, description: "Paged attempt list" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async listAttempts(
    @Param("comparisonId", ParseUUIDPipe) comparisonId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<ComparisonPagedResult<ComparisonAttemptListItemDto>> {
    return this.comparisonQueryService.listComparisonAttempts(comparisonId, query);
  }

  @Post(":comparisonId/retry")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ operationId: "retryComparison", summary: "Retry a Comparison whose latest attempt is terminal and retryable (API-CMP-007)" })
  @ApiResponse({ status: 201, description: "New attempt created and QUEUED", schema: { example: { comparisonAttemptId: "f01c...", attemptNumber: 2, processingStatus: "QUEUED" } } })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({
    status: 409,
    description: "ALREADY_COMPLETED / ATTEMPT_NOT_TERMINAL / REASON_NOT_RETRYABLE / CONCURRENT_RETRY",
    schema: { example: { errorCode: "REASON_NOT_RETRYABLE", message: "The latest attempt's reason code is not retryable", requestId: "..." } },
  })
  async retry(@Param("comparisonId", ParseUUIDPipe) comparisonId: string, @CurrentUser() actorUserId: string): Promise<RetryComparisonResultDto> {
    return this.comparisonQueryService.retryComparison(comparisonId, actorUserId);
  }

  @Post(":comparisonId/classification-events")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ operationId: "createClassificationEvent", summary: "Record an EXPECTED/UNEXPECTED classification for a Comparison (API-CMP-009, Should)" })
  @ApiResponse({ status: 201, description: "Classification event recorded, append-only" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({
    status: 409,
    description: "NOT_CLASSIFIABLE (no COMPLETED/DIFFERENT attempt yet) / REVISION_CONFLICT (expectedRevision is stale)",
    schema: { example: { errorCode: "REVISION_CONFLICT", message: "Revision conflict — current revision is 2", requestId: "..." } },
  })
  async classify(
    @Param("comparisonId", ParseUUIDPipe) comparisonId: string,
    @Body() dto: CreateClassificationEventDto,
    @CurrentUser() actorUserId: string,
  ): Promise<ClassificationEventResultDto> {
    return this.comparisonQueryService.createClassificationEvent(comparisonId, dto, actorUserId);
  }

  @Get(":comparisonId/classification-events")
  @ApiOperation({ operationId: "listClassificationEvents", summary: "List classification history for a Comparison, newest revision first (API-CMP-010)" })
  @ApiResponse({ status: 200, description: "Paged classification event list" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async listClassifications(
    @Param("comparisonId", ParseUUIDPipe) comparisonId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<ComparisonPagedResult<ClassificationEventItemDto>> {
    return this.comparisonQueryService.listClassificationEvents(comparisonId, query);
  }
}
