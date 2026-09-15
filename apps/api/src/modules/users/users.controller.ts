import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { UpdateInvitedUserEmailDto } from "./dto/update-invited-user-email.dto";
import { UsersService, type CurrentUserView, type UpdatedInvitedUserView } from "./users.service";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @UseGuards(SessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the current authenticated user (API-USR-002)" })
  @ApiResponse({ status: 200, description: "Current user" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ACCOUNT_NOT_ALLOWED" })
  async getMe(@CurrentUser() userId: string): Promise<CurrentUserView> {
    return this.usersService.getCurrentUser(userId);
  }

  // API-USR-005 — Admin-only. Authentication via SessionGuard, authorization
  // via the reusable RolesGuard + @Roles("ADMIN") (REQ-USR-006 foundation) —
  // the caller's role is re-read from the DB by RolesGuard, never trusted
  // from client input.
  @Patch(":userId")
  @UseGuards(SessionGuard, RolesGuard)
  @Roles("ADMIN")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update an INVITED user's email (API-USR-005)" })
  @ApiResponse({ status: 200, description: "Email updated" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR (malformed userId) / INVALID_EMAIL_FORMAT" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "ACCESS_DENIED / ROLE_NOT_ASSIGNED / INVALID_SYSTEM_ROLE" })
  @ApiResponse({ status: 404, description: "USER_NOT_FOUND" })
  @ApiResponse({ status: 409, description: "ACCOUNT_NOT_INVITED / EMAIL_ALREADY_EXISTS" })
  async updateInvitedUserEmail(
    // Syntactic/input validation (API Design Standard §12: UUID format is
    // syntactic, not business) — a malformed userId never reaches the
    // handler/service; Nest's ParseUUIDPipe fails it as a standard 400 via
    // the same global exception filter that maps VALIDATION_ERROR.
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() dto: UpdateInvitedUserEmailDto,
  ): Promise<UpdatedInvitedUserView> {
    return this.usersService.updateInvitedUserEmail(userId, dto.email);
  }
}
