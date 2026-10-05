import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ProjectAccessGuard } from "../../common/guards/project-access.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { SessionGuard } from "../../common/guards/session.guard";

import { BulkCreateIgnoreRulesResult, IgnoreRuleResult, IgnoreRulesService } from "./ignore-rules.service";
import { CreateIgnoreRuleDto } from "./dto/create-ignore-rule.dto";
import { BulkCreateIgnoreRulesDto } from "./dto/bulk-create-ignore-rules.dto";
import { UpdateIgnoreRuleDto } from "./dto/update-ignore-rule.dto";
import { ListIgnoreRulesQueryDto } from "./dto/list-ignore-rules-query.dto";

// Output Ignore Rules — Project Settings' Ignore Rules view (spec §4) and
// the single bulk-create entry point used by View Differences' "Ignore
// selected (N)" (spec §5). Reads follow the ProjectAccessGuard-only
// convention every other list route in this repo uses; mutations follow the
// RolesGuard+Roles("ADMIN") convention used by every other Project Settings
// resource (environments, test accounts, authentication, API configs) —
// Ignore Rules change comparison results for every member of the project,
// the same class of change as those.
@ApiTags("ignore-rules")
@Controller("projects/:projectId/ignore-rules")
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class ProjectIgnoreRulesController {
  constructor(private readonly ignoreRulesService: IgnoreRulesService) {}

  @Get()
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "listIgnoreRules", summary: "List Ignore Rules for a Project, optionally filtered by apiId/scope/enabled" })
  @ApiResponse({ status: 200, description: "Ignore Rule list" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async list(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query() query: ListIgnoreRulesQueryDto,
  ): Promise<IgnoreRuleResult[]> {
    return this.ignoreRulesService.list(projectId, query);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @ApiOperation({ operationId: "createIgnoreRule", summary: "Manually add an Ignore Rule (Project Settings) — Admin only" })
  @ApiResponse({ status: 201, description: "Ignore Rule created" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ROLE_NOT_ASSIGNED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "INVALID_STATE / IGNORE_RULE_ALREADY_EXISTS" })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateIgnoreRuleDto,
    @CurrentUser() userId: string,
  ): Promise<IgnoreRuleResult> {
    return this.ignoreRulesService.create(projectId, dto, userId);
  }

  @Post("bulk")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @ApiOperation({
    operationId: "bulkCreateIgnoreRules",
    summary: "Create Ignore Rules for multiple paths in one request — \"Ignore selected (N)\" from View Differences (spec §5) — Admin only",
  })
  @ApiResponse({ status: 201, description: "Created rules plus a count of paths skipped as duplicates" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ROLE_NOT_ASSIGNED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "INVALID_STATE" })
  @HttpCode(HttpStatus.CREATED)
  async bulkCreate(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: BulkCreateIgnoreRulesDto,
    @CurrentUser() userId: string,
  ): Promise<BulkCreateIgnoreRulesResult> {
    return this.ignoreRulesService.bulkCreate(projectId, dto, userId);
  }

  @Patch(":ignoreRuleId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @ApiOperation({ operationId: "updateIgnoreRule", summary: "Enable or disable an Ignore Rule — Admin only" })
  @ApiResponse({ status: 200, description: "Ignore Rule updated" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ROLE_NOT_ASSIGNED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async update(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("ignoreRuleId", ParseUUIDPipe) ignoreRuleId: string,
    @Body() dto: UpdateIgnoreRuleDto,
    @CurrentUser() userId: string,
  ): Promise<IgnoreRuleResult> {
    return this.ignoreRulesService.update(projectId, ignoreRuleId, dto, userId);
  }

  @Delete(":ignoreRuleId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @ApiOperation({ operationId: "removeIgnoreRule", summary: "Delete an Ignore Rule — Admin only" })
  @ApiResponse({ status: 200, description: "Ignore Rule removed" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ROLE_NOT_ASSIGNED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async remove(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("ignoreRuleId", ParseUUIDPipe) ignoreRuleId: string,
    @CurrentUser() userId: string,
  ): Promise<void> {
    return this.ignoreRulesService.remove(projectId, ignoreRuleId, userId);
  }
}
