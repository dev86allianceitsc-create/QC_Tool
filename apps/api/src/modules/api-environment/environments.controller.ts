import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ProjectAccessGuard } from "../../common/guards/project-access.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import type { PagedResult } from "../audit/audit-query.service";
import { CreateEnvironmentDto } from "./dto/create-environment.dto";
import { ListEnvironmentsQueryDto } from "./dto/list-environments-query.dto";
import { UpdateEnvironmentDto } from "./dto/update-environment.dto";
import { EnvironmentDetail, EnvironmentListItem, EnvironmentsService } from "./environments.service";

@ApiTags("environments")
@Controller("projects/:projectId/environments")
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class EnvironmentsController {
  constructor(private readonly environmentsService: EnvironmentsService) {}

  @Get()
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "listEnvironments", summary: "List Environments for a Project (API-ENV-001)" })
  @ApiResponse({ status: 200, description: "Paged Environment list" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async list(@Param("projectId", ParseUUIDPipe) projectId: string, @Query() query: ListEnvironmentsQueryDto): Promise<PagedResult<EnvironmentListItem>> {
    return this.environmentsService.list(projectId, query);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @ApiOperation({ operationId: "createEnvironment", summary: "Create an Environment — Admin only (API-ENV-002)" })
  @ApiResponse({ status: 201, description: "Environment created" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ACCESS_DENIED / ROLE_NOT_ASSIGNED / INVALID_SYSTEM_ROLE" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "ENVIRONMENT_NAME_EXISTS" })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateEnvironmentDto,
    @CurrentUser() userId: string,
  ): Promise<EnvironmentDetail> {
    return this.environmentsService.create(projectId, dto, userId);
  }

  @Get(":environmentId")
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "getEnvironment", summary: "Get Environment detail (API-ENV-003)" })
  @ApiResponse({ status: 200, description: "Environment detail" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async getOne(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("environmentId", ParseUUIDPipe) environmentId: string,
  ): Promise<EnvironmentDetail> {
    return this.environmentsService.getById(projectId, environmentId);
  }

  @Patch(":environmentId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @ApiOperation({
    operationId: "updateEnvironment",
    summary: "Update Environment — rename, classification, Allow Run, lifecycle — Admin only (API-ENV-004)",
  })
  @ApiResponse({ status: 200, description: "Environment updated" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ACCESS_DENIED / ROLE_NOT_ASSIGNED / INVALID_SYSTEM_ROLE" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "ENVIRONMENT_NAME_EXISTS / INVALID_STATE_TRANSITION" })
  async update(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("environmentId", ParseUUIDPipe) environmentId: string,
    @Body() dto: UpdateEnvironmentDto,
    @CurrentUser() userId: string,
  ): Promise<EnvironmentDetail> {
    return this.environmentsService.update(projectId, environmentId, dto, userId);
  }
}
