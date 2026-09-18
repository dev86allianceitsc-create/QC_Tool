import { Body, Controller, Get, Param, ParseUUIDPipe, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ProjectAccessGuard } from "../../common/guards/project-access.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { PutRequestInputDto } from "./dto/put-request-input.dto";
import { RequestInputDefinition, RequestInputService } from "./request-input.service";

// API-INP-001 / API-INP-002 — aggregate singleton Request Input Definition
// for one API (DP-3B-API-01, FROZEN). No row-level CRUD routes by design.
@ApiTags("request-input")
@Controller("projects/:projectId/apis/:apiId/request-input")
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class RequestInputController {
  constructor(private readonly requestInputService: RequestInputService) {}

  @Get()
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "getRequestInputDefinition", summary: "Get the Request Input Definition for an API (API-INP-001)" })
  @ApiResponse({ status: 200, description: "Request Input Definition" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async get(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("apiId", ParseUUIDPipe) apiId: string,
  ): Promise<RequestInputDefinition> {
    return this.requestInputService.get(projectId, apiId);
  }

  @Put()
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "putRequestInputDefinition", summary: "Replace the Request Input Definition for an API (API-INP-002)" })
  @ApiResponse({ status: 200, description: "Request Input Definition replaced" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "CONFLICT / INVALID_STATE" })
  @ApiResponse({ status: 422, description: "SEMANTIC_VALIDATION_ERROR" })
  async put(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("apiId", ParseUUIDPipe) apiId: string,
    @Body() dto: PutRequestInputDto,
    @CurrentUser() userId: string,
  ): Promise<RequestInputDefinition> {
    return this.requestInputService.replace(projectId, apiId, dto, userId);
  }
}
