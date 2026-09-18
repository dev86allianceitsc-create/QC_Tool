import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ProjectAccessGuard } from "../../common/guards/project-access.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import type { PagedResult } from "../audit/audit-query.service";
import { ApiDetail, ApiListItem, ApisService } from "./apis.service";
import { CreateApiDto } from "./dto/create-api.dto";
import { ListApisQueryDto } from "./dto/list-apis-query.dto";
import { UpdateApiDto } from "./dto/update-api.dto";

@ApiTags("apis")
@Controller("projects/:projectId/apis")
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class ApisController {
  constructor(private readonly apisService: ApisService) {}

  @Get()
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "listApis", summary: "List APIs for a Project (API-API-001)" })
  @ApiResponse({ status: 200, description: "Paged API list" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async list(@Param("projectId", ParseUUIDPipe) projectId: string, @Query() query: ListApisQueryDto): Promise<PagedResult<ApiListItem>> {
    return this.apisService.list(projectId, query);
  }

  @Post()
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "createApi", summary: "Manually create an API (API-API-002)" })
  @ApiResponse({ status: 201, description: "API created" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "API_ALREADY_EXISTS" })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateApiDto,
    @CurrentUser() userId: string,
  ): Promise<ApiDetail> {
    return this.apisService.create(projectId, dto, userId);
  }

  @Get(":apiId")
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "getApi", summary: "Get API detail (API-API-003)" })
  @ApiResponse({ status: 200, description: "API detail" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async getOne(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("apiId", ParseUUIDPipe) apiId: string,
  ): Promise<ApiDetail> {
    return this.apisService.getById(projectId, apiId);
  }

  @Patch(":apiId")
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "updateApi", summary: "Edit API name/method/path/description (API-API-004)" })
  @ApiResponse({ status: 200, description: "API updated" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "API_ALREADY_EXISTS" })
  async update(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("apiId", ParseUUIDPipe) apiId: string,
    @Body() dto: UpdateApiDto,
    @CurrentUser() userId: string,
  ): Promise<ApiDetail> {
    return this.apisService.update(projectId, apiId, dto, userId);
  }

  @Delete(":apiId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @ApiOperation({ operationId: "deleteApi", summary: "Soft delete an API — Admin only (API-API-005)" })
  @ApiResponse({ status: 204, description: "API soft-deleted" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ACCESS_DENIED / ROLE_NOT_ASSIGNED / INVALID_SYSTEM_ROLE" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("apiId", ParseUUIDPipe) apiId: string,
    @CurrentUser() userId: string,
  ): Promise<void> {
    await this.apisService.softDelete(projectId, apiId, userId);
  }
}
