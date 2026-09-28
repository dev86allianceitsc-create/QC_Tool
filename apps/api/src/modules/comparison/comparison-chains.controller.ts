import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { SessionGuard } from "../../common/guards/session.guard";

import { ComparisonChainAccessGuard } from "./comparison-chain-access.guard";
import { ComparisonChainDetailDto, ComparisonQueryService } from "./comparison-query.service";

// API-CMP-008 (AnD API v0.2 §3/§4). No :projectId in this path —
// ComparisonChainAccessGuard checks access to the chain's single
// authoritative Project and collapses any denial into the same 404 as
// "chain does not exist" (comparison-chain-access.guard.ts).
@ApiTags("comparisons")
@Controller("comparison-chains")
@UseGuards(SessionGuard, ComparisonChainAccessGuard)
@ApiBearerAuth()
export class ComparisonChainsController {
  constructor(private readonly comparisonQueryService: ComparisonQueryService) {}

  @Get(":comparisonChainId")
  @ApiOperation({ operationId: "getComparisonChain", summary: "Get a Comparison chain and its ordered adjacent-pair Comparisons (API-CMP-008)" })
  @ApiResponse({ status: 200, description: "Chain detail with a paged, pairOrdinal-ordered list of Comparisons" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async getOne(
    @Param("comparisonChainId", ParseUUIDPipe) comparisonChainId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<ComparisonChainDetailDto> {
    return this.comparisonQueryService.getComparisonChain(comparisonChainId, query);
  }
}
