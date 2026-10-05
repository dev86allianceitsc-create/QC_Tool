import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ProjectAccessGuard } from "../../common/guards/project-access.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { CreateTestAccountDto } from "./dto/create-test-account.dto";
import { UpdateTestAccountDto } from "./dto/update-test-account.dto";
import { TestAccountResult, TestAccountService } from "./test-account.service";

// REVISION 3C-R02 — named Login Form credentials, 0..N per Environment.
// Only valid while the Environment's Authentication is LOGIN_FORM; every
// route is Admin-only for mutation and never returns the password.
@ApiTags("authentication")
@Controller("projects/:projectId/environments/:environmentId/authentication/test-accounts")
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class TestAccountController {
  constructor(private readonly testAccountService: TestAccountService) {}

  @Get()
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "listTestAccounts", summary: "List Test Accounts for an Environment" })
  @ApiResponse({ status: 200, description: "Test Account list" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "INVALID_STATE" })
  async list(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("environmentId", ParseUUIDPipe) environmentId: string,
  ): Promise<TestAccountResult[]> {
    return this.testAccountService.list(projectId, environmentId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @ApiOperation({ operationId: "createTestAccount", summary: "Create a Test Account — Admin only" })
  @ApiResponse({ status: 201, description: "Test Account created" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ROLE_NOT_ASSIGNED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "INVALID_STATE / TEST_ACCOUNT_LABEL_EXISTS" })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("environmentId", ParseUUIDPipe) environmentId: string,
    @Body() dto: CreateTestAccountDto,
    @CurrentUser() userId: string,
  ): Promise<TestAccountResult> {
    return this.testAccountService.create(projectId, environmentId, dto, userId);
  }

  @Put(":testAccountId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @ApiOperation({ operationId: "updateTestAccount", summary: "Update a Test Account (rename, re-point, or rotate password) — Admin only" })
  @ApiResponse({ status: 200, description: "Test Account updated" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ROLE_NOT_ASSIGNED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "INVALID_STATE / TEST_ACCOUNT_LABEL_EXISTS" })
  async update(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("environmentId", ParseUUIDPipe) environmentId: string,
    @Param("testAccountId", ParseUUIDPipe) testAccountId: string,
    @Body() dto: UpdateTestAccountDto,
    @CurrentUser() userId: string,
  ): Promise<TestAccountResult> {
    return this.testAccountService.update(projectId, environmentId, testAccountId, dto, userId);
  }

  @Delete(":testAccountId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @ApiOperation({ operationId: "removeTestAccount", summary: "Remove a Test Account — Admin only" })
  @ApiResponse({ status: 200, description: "Test Account removed" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ROLE_NOT_ASSIGNED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "INVALID_STATE" })
  async remove(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("environmentId", ParseUUIDPipe) environmentId: string,
    @Param("testAccountId", ParseUUIDPipe) testAccountId: string,
    @CurrentUser() userId: string,
  ): Promise<void> {
    return this.testAccountService.remove(projectId, environmentId, testAccountId, userId);
  }
}
