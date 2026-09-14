import { ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { RequestWithUserId } from "../guards/session.guard";

// Reads the userId attached by SessionGuard. Never derived from client input
// (query/body/header) — the client cannot spoof which user this resolves to.
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<RequestWithUserId>();
  return request.userId as string;
});
