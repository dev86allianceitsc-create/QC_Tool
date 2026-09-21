import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ProjectAccessGuard } from "../../common/guards/project-access.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { AuthenticationConfigurationResult, AuthenticationService } from "./authentication.service";
import { PutAuthenticationConfigurationDto } from "./dto/put-authentication-configuration.dto";
import { PutCredentialDto } from "./dto/put-credential.dto";

// Group 3C — Authentication Configuration (REQ-SEC-002, REQ-AUTH-001/002/003).
// Credential isolation boundary = (apiId, environmentId); Admin-only
// mutation; Secret Credential Value is never returned by any route.
@ApiTags("authentication")
@Controller("projects/:projectId/apis/:apiId/environment-configs/:environmentId/authentication")
@UseGuards(SessionGuard)
@ApiBearerAuth()
export class AuthenticationController {
  constructor(private readonly authenticationService: AuthenticationService) {}

  @Get()
  @UseGuards(ProjectAccessGuard)
  @ApiOperation({ operationId: "getAuthenticationConfiguration", summary: "Get the Authentication Configuration for an API + Environment" })
  @ApiResponse({ status: 200, description: "Authentication Configuration (type, status, safe metadata)" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  async get(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("apiId", ParseUUIDPipe) apiId: string,
    @Param("environmentId", ParseUUIDPipe) environmentId: string,
  ): Promise<AuthenticationConfigurationResult> {
    return this.authenticationService.get(projectId, apiId, environmentId);
  }

  @Put()
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @ApiOperation({ operationId: "putAuthenticationConfiguration", summary: "Set/replace the Auth Type and non-secret config — Admin only" })
  @ApiResponse({ status: 200, description: "Authentication Configuration saved" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ROLE_NOT_ASSIGNED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "INVALID_STATE" })
  @ApiResponse({ status: 422, description: "SEMANTIC_VALIDATION_ERROR" })
  async putConfiguration(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("apiId", ParseUUIDPipe) apiId: string,
    @Param("environmentId", ParseUUIDPipe) environmentId: string,
    @Body() dto: PutAuthenticationConfigurationDto,
    @CurrentUser() userId: string,
  ): Promise<AuthenticationConfigurationResult> {
    return this.authenticationService.putConfiguration(projectId, apiId, environmentId, dto, userId);
  }

  @Put("credential")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @ApiOperation({ operationId: "putAuthenticationCredential", summary: "Create/Replace the Secret Credential Value for the current Auth Type — Admin only" })
  @ApiResponse({ status: 200, description: "Credential saved" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ROLE_NOT_ASSIGNED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "INVALID_STATE" })
  async putCredential(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("apiId", ParseUUIDPipe) apiId: string,
    @Param("environmentId", ParseUUIDPipe) environmentId: string,
    @Body() dto: PutCredentialDto,
    @CurrentUser() userId: string,
  ): Promise<AuthenticationConfigurationResult> {
    return this.authenticationService.putCredential(projectId, apiId, environmentId, dto, userId);
  }

  @Delete("credential")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @ApiOperation({ operationId: "removeAuthenticationCredential", summary: "Remove the Secret Credential Value, back to Not configured — Admin only" })
  @ApiResponse({ status: 200, description: "Credential removed" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ROLE_NOT_ASSIGNED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "INVALID_STATE" })
  async removeCredential(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("apiId", ParseUUIDPipe) apiId: string,
    @Param("environmentId", ParseUUIDPipe) environmentId: string,
    @CurrentUser() userId: string,
  ): Promise<AuthenticationConfigurationResult> {
    return this.authenticationService.removeCredential(projectId, apiId, environmentId, userId);
  }
}
