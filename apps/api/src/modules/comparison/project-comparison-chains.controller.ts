import { Body, Controller, Param, ParseUUIDPipe, Post, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ProjectAccessGuard } from "../../common/guards/project-access.guard";
import { SessionGuard } from "../../common/guards/session.guard";

import { ComparisonQueryService, CreateChainResultDto } from "./comparison-query.service";
import { CreateComparisonChainDto } from "./dto/create-comparison-chain.dto";

// API-CMP-002 (AnD API v0.2 §3). Only the two endpoint Snapshots are
// client-supplied — every Snapshot in between (including one invalidated
// mid-chain) is resolved and frozen server-side.
@ApiTags("comparisons")
@Controller("projects/:projectId/comparison-chains")
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class ProjectComparisonChainsController {
  constructor(private readonly comparisonQueryService: ComparisonQueryService) {}

  @Post()
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "createComparisonChain", summary: "Create a Comparison chain across every Snapshot between two endpoints (API-CMP-002)" })
  @ApiResponse({
    status: 201,
    description: "Chain created; one Comparison + first attempt QUEUED per adjacent Snapshot pair. Location header points at the new chain.",
    schema: { example: { comparisonChainId: "e7a4...", selectedSnapshotCount: 4, pairCount: 3 } },
  })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND — Project, or either endpoint Snapshot, does not exist or is not visible to the caller" })
  @ApiResponse({
    status: 422,
    description: "SEMANTIC_VALIDATION_ERROR — identical endpoints, endpoints spanning different Project/API/Environment/auth context, or fewer than 2 Snapshots resolved",
  })
  async create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateComparisonChainDto,
    @CurrentUser() actorUserId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CreateChainResultDto> {
    const result = await this.comparisonQueryService.createComparisonChain(projectId, dto, actorUserId);
    res.status(201).header("Location", `/api/v1/comparison-chains/${result.comparisonChainId}`);
    return result;
  }
}
