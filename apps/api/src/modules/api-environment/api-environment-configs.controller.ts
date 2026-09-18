import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ProjectAccessGuard } from "../../common/guards/project-access.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { ApiEnvironmentConfigListItem, ApiEnvironmentConfigResult, ApiEnvironmentConfigsService } from "./api-environment-configs.service";
import { PutApiEnvironmentConfigDto } from "./dto/put-api-environment-config.dto";

@ApiTags("api-environment-configs")
@Controller("projects/:projectId/apis/:apiId/environment-configs")
@UseGuards(SessionGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class ApiEnvironmentConfigsController {
  constructor(private readonly configsService: ApiEnvironmentConfigsService) {}

  @Get()
  @ApiOperation({ operationId: "listApiEnvironmentConfigs", summary: "List Full URL / credential status per Environment for an API (API-APIENV-001)" })
  @ApiResponse({ status: 200, description: "Per-Environment configuration status" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async list(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("apiId", ParseUUIDPipe) apiId: string,
  ): Promise<{ apiId: string; items: ApiEnvironmentConfigListItem[] }> {
    return this.configsService.list(projectId, apiId);
  }

  @Put(":environmentId")
  @ApiOperation({ operationId: "putApiEnvironmentConfig", summary: "Configure/replace the Full URL for an API in an Environment (API-APIENV-002)" })
  @ApiResponse({ status: 200, description: "Full URL updated" })
  @ApiResponse({ status: 201, description: "Full URL configured for the first time" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "INVALID_STATE" })
  @ApiResponse({ status: 422, description: "SEMANTIC_VALIDATION_ERROR" })
  async put(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("apiId", ParseUUIDPipe) apiId: string,
    @Param("environmentId", ParseUUIDPipe) environmentId: string,
    @Body() dto: PutApiEnvironmentConfigDto,
    @CurrentUser() userId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { status, body } = await this.configsService.put(projectId, apiId, environmentId, dto, userId);
    res.status(status).json(body);
  }
}
