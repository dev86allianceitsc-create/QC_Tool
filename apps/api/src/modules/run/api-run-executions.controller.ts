import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ProjectAccessGuard } from "../../common/guards/project-access.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import type { PagedResult } from "../audit/audit-query.service";
import { ListApiRunExecutionsQueryDto } from "./dto/list-api-run-executions-query.dto";
import { ApiRunExecutionListItem, RunsService } from "./runs.service";

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
}
