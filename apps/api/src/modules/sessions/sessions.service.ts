import { Injectable } from "@nestjs/common";
import type { UserSession } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { isUuid } from "../../common/utils/uuid";

export type SessionState = "ACTIVE" | "EXPIRED" | "REVOKED";

export type SessionResolution =
  | { state: "NOT_FOUND" }
  | { state: SessionState; session: UserSession };

const DEFAULT_SESSION_TTL_HOURS = 8;

export function sessionTtlHours(): number {
  const raw = Number(process.env.SESSION_TTL_HOURS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_SESSION_TTL_HOURS;
}

export function computeExpiresAt(createdAt: Date, ttlHours: number = sessionTtlHours()): Date {
  return new Date(createdAt.getTime() + ttlHours * 60 * 60 * 1000);
}

function deriveState(session: UserSession, now: Date): SessionState {
  if (session.revokedAt !== null) {
    return "REVOKED";
  }
  if (now >= session.expiresAt) {
    return "EXPIRED";
  }
  return "ACTIVE";
}

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, ttlHours: number = sessionTtlHours()): Promise<UserSession> {
    const createdAt = new Date();
    const expiresAt = computeExpiresAt(createdAt, ttlHours);
    return this.prisma.userSession.create({
      data: { userId, createdAt, expiresAt },
    });
  }

  async resolveByToken(token: string): Promise<SessionResolution> {
    if (!isUuid(token)) {
      return { state: "NOT_FOUND" };
    }
    const session = await this.prisma.userSession.findUnique({ where: { sessionId: token } });
    if (!session) {
      return { state: "NOT_FOUND" };
    }
    return { state: deriveState(session, new Date()), session };
  }

  // Idempotent: a no-op if the session is already revoked.
  async revoke(sessionId: string): Promise<void> {
    await this.prisma.userSession.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
