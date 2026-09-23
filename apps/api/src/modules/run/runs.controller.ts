import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ProjectAccessGuard } from "../../common/guards/project-access.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import type { PagedResult } from "../audit/audit-query.service";
import { CreateRunDto } from "./dto/create-run.dto";
import { ListRunsQueryDto } from "./dto/list-runs-query.dto";
import { RunDetail, RunExecutionDetail, RunListItem, RunsService } from "./runs.service";

@ApiTags("runs")
@Controller("projects/:projectId/runs")
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Post()
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "createRun", summary: "Create and dispatch a Single or Batch Run (API-RUN-001)" })
  @ApiResponse({ status: 201, description: "Run created and dispatch started" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED / RUN_NOT_ALLOWED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "INVALID_STATE" })
  @ApiResponse({ status: 422, description: "SEMANTIC_VALIDATION_ERROR" })
  @HttpCode(HttpStatus.CREATED)
  async create(@Param("projectId", ParseUUIDPipe) projectId: string, @Body() dto: CreateRunDto, @CurrentUser() userId: string): Promise<RunDetail> {
    return this.runsService.createRun(projectId, dto, userId);
  }

  @Get()
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "listRuns", summary: "List Runs for a Project (API-RUN-004)" })
  @ApiResponse({ status: 200, description: "Paged Run list" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async list(@Param("projectId", ParseUUIDPipe) projectId: string, @Query() query: ListRunsQueryDto): Promise<PagedResult<RunListItem>> {
    return this.runsService.listRuns(projectId, query);
  }

  @Get(":runId")
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "getRun", summary: "Get Run detail with per-execution status (API-RUN-002)" })
  @ApiResponse({ status: 200, description: "Run detail" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async getOne(@Param("projectId", ParseUUIDPipe) projectId: string, @Param("runId", ParseUUIDPipe) runId: string): Promise<RunDetail> {
    return this.runsService.getRun(projectId, runId);
  }

  @Get(":runId/executions/:executionId")
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "getRunExecution", summary: "Get one Run Execution's full detail incl. actual request/response (API-RUN-003)" })
  @ApiResponse({ status: 200, description: "Run Execution detail" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async getExecution(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("runId", ParseUUIDPipe) runId: string,
    @Param("executionId", ParseUUIDPipe) executionId: string,
  ): Promise<RunExecutionDetail> {
    return this.runsService.getRunExecution(projectId, runId, executionId);
  }
}
