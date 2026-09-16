import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ProjectAccessGuard } from "../../common/guards/project-access.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { PrismaService } from "../../prisma/prisma.service";
import type { PagedResult } from "../audit/audit-query.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { ListProjectsQueryDto } from "./dto/list-projects-query.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectsService, type ProjectDetail, type ProjectListItem } from "./projects.service";

@ApiTags("projects")
@Controller("projects")
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ operationId: "listProjects", summary: "List projects — Admin sees all, User sees own memberships (API-PRJ-001)" })
  @ApiResponse({ status: 200, description: "Paged project list" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  async list(@Query() query: ListProjectsQueryDto, @CurrentUser() userId: string): Promise<PagedResult<ProjectListItem>> {
    const isAdmin = await this.isCallerAdmin(userId);
    return this.projectsService.list(query, userId, isAdmin);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @ApiOperation({ operationId: "createProject", summary: "Create a project (API-PRJ-002)" })
  @ApiResponse({ status: 201, description: "Project created" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ACCESS_DENIED / ROLE_NOT_ASSIGNED / INVALID_SYSTEM_ROLE" })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProjectDto, @CurrentUser() userId: string): Promise<ProjectDetail> {
    return this.projectsService.create(dto, userId);
  }

  @Get(":projectId")
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "getProject", summary: "Get project detail — Admin or member User (API-PRJ-003)" })
  @ApiResponse({ status: 200, description: "Project detail" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async getOne(@Param("projectId", ParseUUIDPipe) projectId: string): Promise<ProjectDetail> {
    return this.projectsService.getById(projectId);
  }

  @Patch(":projectId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @ApiOperation({ operationId: "updateProject", summary: "Update project name/description/status (API-PRJ-004)" })
  @ApiResponse({ status: 200, description: "Project updated" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ACCESS_DENIED / ROLE_NOT_ASSIGNED / INVALID_SYSTEM_ROLE" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "CONFLICT" })
  async update(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() userId: string,
  ): Promise<ProjectDetail> {
    return this.projectsService.update(projectId, dto, userId);
  }

  @Delete(":projectId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: "deleteProject", summary: "Soft delete a project (API-PRJ-005)" })
  @ApiResponse({ status: 204, description: "Project soft-deleted" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ACCESS_DENIED / ROLE_NOT_ASSIGNED / INVALID_SYSTEM_ROLE" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async remove(@Param("projectId", ParseUUIDPipe) projectId: string, @CurrentUser() userId: string): Promise<void> {
    await this.projectsService.softDelete(projectId, userId);
  }

  // API-PRJ-001 has no :projectId to hang ProjectAccessGuard/RolesGuard off
  // of — ADMIN vs USER scoping is a query concern, not a route-guard concern
  // — so the caller's role is resolved directly here, the same way
  // RolesGuard resolves it, and passed into the service.
  private async isCallerAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { userId }, select: { systemRole: true } });
    return user?.systemRole === "ADMIN";
  }
}
