import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ProjectAccessGuard } from "../../common/guards/project-access.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import type { PagedResult } from "../audit/audit-query.service";
import { AddMemberDto } from "./dto/add-member.dto";
import { ListMembersQueryDto } from "./dto/list-members-query.dto";
import { ProjectMembersService, type ProjectMemberView } from "./project-members.service";

@ApiTags("project-members")
@Controller("projects/:projectId/members")
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class ProjectMembersController {
  constructor(private readonly projectMembersService: ProjectMembersService) {}

  @Get()
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "listProjectMembers", summary: "List project members — Admin or member User (API-PRJ-006)" })
  @ApiResponse({ status: 200, description: "Paged member list" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async list(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query() query: ListMembersQueryDto,
  ): Promise<PagedResult<ProjectMemberView>> {
    return this.projectMembersService.list(projectId, query);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ operationId: "addProjectMember", summary: "Add a project member by email — resolve-or-create (API-PRJ-007)" })
  @ApiResponse({ status: 201, description: "Member added" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ACCESS_DENIED / ROLE_NOT_ASSIGNED / INVALID_SYSTEM_ROLE" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "CONFLICT" })
  @ApiResponse({ status: 422, description: "MEMBER_NOT_ELIGIBLE" })
  async add(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() userId: string,
  ): Promise<ProjectMemberView> {
    return this.projectMembersService.addMember(projectId, dto, userId);
  }

  @Delete(":userId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: "removeProjectMember", summary: "Remove a project member (API-PRJ-008)" })
  @ApiResponse({ status: 204, description: "Member removed" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ACCESS_DENIED / ROLE_NOT_ASSIGNED / INVALID_SYSTEM_ROLE" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async remove(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @CurrentUser() actorUserId: string,
  ): Promise<void> {
    await this.projectMembersService.removeMember(projectId, userId, actorUserId);
  }
}
