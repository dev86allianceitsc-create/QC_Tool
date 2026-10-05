import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ProjectAccessGuard } from "../../common/guards/project-access.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import type { PagedResult } from "../audit/audit-query.service";
import { ListApiRunExecutionsQueryDto } from "./dto/list-api-run-executions-query.dto";
import { ApiRunExecutionListItem, RunDetail, RunsService } from "./runs.service";

@ApiTags("runs")
@Controller("projects/:projectId/apis/:apiId/run-executions")
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class ApiRunExecutionsController {
  constructor(private readonly runsService: RunsService) {}

  @Get()
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "listApiRunExecutions", summary: "List Run Executions for one API across Runs (API-RUN-005)" })
  @ApiResponse({ status: 200, description: "Paged Run Execution list for this API" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async list(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("apiId", ParseUUIDPipe) apiId: string,
    @Query() query: ListApiRunExecutionsQueryDto,
  ): Promise<PagedResult<ApiRunExecutionListItem>> {
    return this.runsService.listApiRunExecutions(projectId, apiId, query);
  }

  @Post(":executionId/run-again")
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "runAgain", summary: "Re-submit a Test Case's saved Request Input; auto-chains against its most recent execution (Phase 3 §4)" })
  @ApiResponse({ status: 201, description: "New Run created and dispatch started" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED / RUN_NOT_ALLOWED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 422, description: "NO_SAVED_INPUT" })
  @HttpCode(HttpStatus.CREATED)
  async runAgain(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("apiId", ParseUUIDPipe) apiId: string,
    @Param("executionId", ParseUUIDPipe) executionId: string,
    @CurrentUser() userId: string,
  ): Promise<RunDetail> {
    return this.runsService.runAgain(projectId, apiId, executionId, userId);
  }

  @Post(":executionId/rerun")
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "reRunExecution", summary: "Advanced: re-run one specific historical execution, forcing the comparison baseline back to it (Phase 3 §5)" })
  @ApiResponse({ status: 201, description: "New Run created and dispatch started" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED / RUN_NOT_ALLOWED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 422, description: "NOT_REPLAYABLE" })
  @HttpCode(HttpStatus.CREATED)
  async rerun(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("apiId", ParseUUIDPipe) apiId: string,
    @Param("executionId", ParseUUIDPipe) executionId: string,
    @CurrentUser() userId: string,
  ): Promise<RunDetail> {
    return this.runsService.reRunExecution(projectId, apiId, executionId, userId);
  }
}
