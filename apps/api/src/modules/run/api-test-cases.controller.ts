import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ProjectAccessGuard } from "../../common/guards/project-access.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { RunsService, TestCaseListItem } from "./runs.service";

// Phase 3 Test Case History & Run Again (§7/§8) — the Run History tab's
// grouped view, one card per distinct testCaseKey. Deliberately a sibling
// resource of run-executions (ApiRunExecutionsController), not nested under
// it — a Test Case groups executions, it is not itself one.
@ApiTags("runs")
@Controller("projects/:projectId/apis/:apiId/test-cases")
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class ApiTestCasesController {
  constructor(private readonly runsService: RunsService) {}

  @Get()
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "listTestCases", summary: "List Test Case cards (grouped by Test Case Identity) for one API (Phase 3 §7/§8)" })
  @ApiResponse({ status: 200, description: "One card per distinct Test Case for this API, most recently run first" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async list(@Param("projectId", ParseUUIDPipe) projectId: string, @Param("apiId", ParseUUIDPipe) apiId: string): Promise<TestCaseListItem[]> {
    return this.runsService.listTestCases(projectId, apiId);
  }
}
