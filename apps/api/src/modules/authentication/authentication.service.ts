import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";
import { encryptSecret } from "../../common/utils/credential-crypto";
import { AuditWriterService } from "../audit/audit-writer.service";
import { assertProjectActive } from "../api-environment/apis.service";
import { PutAuthenticationConfigurationDto, AuthTypeValue } from "./dto/put-authentication-configuration.dto";
import { PutCredentialDto } from "./dto/put-credential.dto";

export type AuthType = AuthTypeValue;
export type CredentialStatus = "NOT_REQUIRED" | "CONFIGURED" | "NOT_CONFIGURED";

export interface AuthenticationConfigurationResult {
  apiId: string;
  environmentId: string;
  authType: AuthType;
  credentialStatus: CredentialStatus;
  loginUrl: string | null;
  username: string | null;
  usernameField: string | null;
  passwordField: string | null;
  tokenResponsePath: string | null;
  updatedAt: Date | null;
}

interface AuthConfigRow {
  authType: string;
  loginUrl: string | null;
  username: string | null;
  usernameField: string | null;
  passwordField: string | null;
  tokenResponsePath: string | null;
  updatedAt: Date;
  passwordCiphertext: Uint8Array | null;
  bearerTokenCiphertext: Uint8Array | null;
}

const TOKEN_RESPONSE_PATH_PATTERN = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/;

function validateLoginUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "loginUrl is not a well-formed URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new BusinessException(
      HttpStatus.UNPROCESSABLE_ENTITY,
      "SEMANTIC_VALIDATION_ERROR",
      "loginUrl must be an absolute HTTP or HTTPS URL",
    );
  }
}

function hasSecret(row: { passwordCiphertext: Uint8Array | null; bearerTokenCiphertext: Uint8Array | null }): boolean {
  return row.passwordCiphertext !== null || row.bearerTokenCiphertext !== null;
}

function credentialStatusFor(authType: AuthType, secretPresent: boolean): CredentialStatus {
  if (authType === "NONE") {
    return "NOT_REQUIRED";
  }
  return secretPresent ? "CONFIGURED" : "NOT_CONFIGURED";
}

async function findApiAndEnvironment(
  prisma: Prisma.TransactionClient | PrismaService,
  projectId: string,
  apiId: string,
  environmentId: string,
): Promise<{
  api: { apiId: string; apiName: string };
  environment: { environmentId: string; environmentName: string; environmentStatus: string };
}> {
  const [api, environment] = await Promise.all([
    prisma.apiConfiguration.findFirst({ where: { apiId, projectId, deletedAt: null } }),
    prisma.environment.findFirst({ where: { environmentId, projectId } }),
  ]);
  if (!api) {
    throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "API does not exist");
  }
  if (!environment) {
    throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Environment does not exist");
  }
  return { api, environment };
}

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  async get(projectId: string, apiId: string, environmentId: string): Promise<AuthenticationConfigurationResult> {
    await findApiAndEnvironment(this.prisma, projectId, apiId, environmentId);
    const row = await this.prisma.authenticationConfiguration.findUnique({
      where: { apiId_environmentId: { apiId, environmentId } },
    });
    return this.toResult(apiId, environmentId, row);
  }

  async putConfiguration(
    projectId: string,
    apiId: string,
    environmentId: string,
    dto: PutAuthenticationConfigurationDto,
    actorUserId: string,
  ): Promise<AuthenticationConfigurationResult> {
    this.validateConfigDto(dto);

    return this.prisma.$transaction(async (tx) => {
      await assertProjectActive(tx, projectId);
      const { api, environment } = await findApiAndEnvironment(tx, projectId, apiId, environmentId);
      if (environment.environmentStatus !== "ACTIVE") {
        throw new BusinessException(HttpStatus.CONFLICT, "INVALID_STATE", "Environment is not ACTIVE");
      }

      const existing = await tx.authenticationConfiguration.findUnique({
        where: { apiId_environmentId: { apiId, environmentId } },
      });
      const previousAuthType = (existing?.authType ?? "NONE") as AuthType;
      const typeChanged = previousAuthType !== dto.authType;

      // context_version (Group 5 Q5 answer): a brand-new row always starts at
      // 1, never "increments". On an existing row, identity/access changed —
      // and the version must advance — when auth_type itself changed, or
      // when it stays LOGIN_FORM but the username changed. Technical-field-only
      // edits (loginUrl, usernameField, passwordField, tokenResponsePath)
      // never increment on their own.
      const nextUsername = dto.authType === "LOGIN_FORM" ? (dto.username ?? null) : null;
      const usernameChanged = !typeChanged && dto.authType === "LOGIN_FORM" && existing !== null && existing.username !== nextUsername;
      const contextVersion = existing === null ? 1 : typeChanged || usernameChanged ? existing.contextVersion + 1 : existing.contextVersion;

      const data: Prisma.AuthenticationConfigurationUncheckedCreateInput = {
        apiId,
        environmentId,
        authType: dto.authType,
        contextVersion,
        loginUrl: dto.authType === "LOGIN_FORM" ? (dto.loginUrl ?? null) : null,
        username: nextUsername,
        usernameField: dto.authType === "LOGIN_FORM" ? (dto.usernameField ?? null) : null,
        passwordField: dto.authType === "LOGIN_FORM" ? (dto.passwordField ?? null) : null,
        tokenResponsePath: dto.authType === "LOGIN_FORM" ? (dto.tokenResponsePath ?? null) : null,
      };

      // CL-3C-02 (REQ-AUTH-003): changing auth_type removes the old type's
      // credential in the same mutation — no separate confirm endpoint, the
      // frontend confirms via dialog before calling this at all.
      if (typeChanged) {
        data.passwordCiphertext = null;
        data.passwordIv = null;
        data.passwordAuthTag = null;
        data.bearerTokenCiphertext = null;
        data.bearerTokenIv = null;
        data.bearerTokenAuthTag = null;
      }

      const saved = await tx.authenticationConfiguration.upsert({
        where: { apiId_environmentId: { apiId, environmentId } },
        create: data,
        update: data,
      });

      await this.auditWriter.record(
        {
          eventType: typeChanged ? "AUTH_TYPE_CHANGED" : "AUTHENTICATION_CONFIGURATION_UPDATED",
          result: "SUCCESS",
          actorUserId,
          targetType: "AUTHENTICATION_CONFIGURATION",
          targetId: `${apiId}:${environmentId}`,
          targetDisplay: `${api.apiName} @ ${environment.environmentName}`,
          projectId,
          beforeData: { authType: previousAuthType, credentialConfigured: existing ? hasSecret(existing) : false },
          afterData: { authType: saved.authType, credentialConfigured: hasSecret(saved) },
        },
        tx,
      );

      return this.toResult(apiId, environmentId, saved);
    });
  }

  async putCredential(
    projectId: string,
    apiId: string,
    environmentId: string,
    dto: PutCredentialDto,
    actorUserId: string,
  ): Promise<AuthenticationConfigurationResult> {
    return this.prisma.$transaction(async (tx) => {
      await assertProjectActive(tx, projectId);
      const { api, environment } = await findApiAndEnvironment(tx, projectId, apiId, environmentId);
      if (environment.environmentStatus !== "ACTIVE") {
        throw new BusinessException(HttpStatus.CONFLICT, "INVALID_STATE", "Environment is not ACTIVE");
      }

      const existing = await tx.authenticationConfiguration.findUnique({
        where: { apiId_environmentId: { apiId, environmentId } },
      });
      const authType = (existing?.authType ?? "NONE") as AuthType;
      if (authType === "NONE" || !existing) {
        throw new BusinessException(
          HttpStatus.CONFLICT,
          "INVALID_STATE",
          "Authentication type is NONE; no credential can be configured",
        );
      }

      let updateData: Prisma.AuthenticationConfigurationUpdateInput;
      if (authType === "LOGIN_FORM") {
        if (!dto.password) {
          throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "password is required for LOGIN_FORM");
        }
        const encrypted = encryptSecret(dto.password);
        updateData = {
          passwordCiphertext: encrypted.ciphertext,
          passwordIv: encrypted.iv,
          passwordAuthTag: encrypted.authTag,
        };
      } else {
        if (!dto.token) {
          throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "token is required for BEARER_TOKEN");
        }
        const normalizedToken = dto.token.replace(/^Bearer\s+/i, "").trim();
        if (!normalizedToken) {
          throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "token must not be empty");
        }
        const encrypted = encryptSecret(normalizedToken);
        updateData = {
          bearerTokenCiphertext: encrypted.ciphertext,
          bearerTokenIv: encrypted.iv,
          bearerTokenAuthTag: encrypted.authTag,
        };
      }

      const wasConfigured = hasSecret(existing);

      // context_version (Group 5 Q5 answer). LOGIN_FORM password-only
      // replacement never increments — this endpoint has no username field,
      // so identity is unchanged by construction. BEARER_TOKEN is opaque: a
      // replacement increments by default (new context) unless the config
      // owner explicitly confirms sameIdentity. The very first credential
      // ever set on this row never increments here — there is nothing to
      // compare it against, and putConfiguration already counted any
      // type-change that made a credential possible in the first place.
      if (wasConfigured && authType === "BEARER_TOKEN" && dto.sameIdentity !== true) {
        updateData.contextVersion = { increment: 1 };
      }

      const saved = await tx.authenticationConfiguration.update({
        where: { apiId_environmentId: { apiId, environmentId } },
        data: updateData,
      });

      await this.auditWriter.record(
        {
          eventType: wasConfigured ? "CREDENTIAL_REPLACED" : "CREDENTIAL_CONFIGURED",
          result: "SUCCESS",
          actorUserId,
          targetType: "AUTHENTICATION_CONFIGURATION",
          targetId: `${apiId}:${environmentId}`,
          targetDisplay: `${api.apiName} @ ${environment.environmentName}`,
          projectId,
          beforeData: { authType, credentialConfigured: wasConfigured },
          afterData: { authType, credentialConfigured: true },
        },
        tx,
      );

      return this.toResult(apiId, environmentId, saved);
    });
  }

  async removeCredential(
    projectId: string,
    apiId: string,
    environmentId: string,
    actorUserId: string,
  ): Promise<AuthenticationConfigurationResult> {
    return this.prisma.$transaction(async (tx) => {
      await assertProjectActive(tx, projectId);
      const { api, environment } = await findApiAndEnvironment(tx, projectId, apiId, environmentId);
      if (environment.environmentStatus !== "ACTIVE") {
        throw new BusinessException(HttpStatus.CONFLICT, "INVALID_STATE", "Environment is not ACTIVE");
      }

      const existing = await tx.authenticationConfiguration.findUnique({
        where: { apiId_environmentId: { apiId, environmentId } },
      });
      const authType = (existing?.authType ?? "NONE") as AuthType;

      if (!existing || !hasSecret(existing)) {
        // Idempotent: already Not configured — no state change, no audit noise.
        return this.toResult(apiId, environmentId, existing);
      }

      // context_version (Group 5 Q5 answer): access materially changed to
      // NOT_CONFIGURED, so this counts as an identity/access change.
      const saved = await tx.authenticationConfiguration.update({
        where: { apiId_environmentId: { apiId, environmentId } },
        data: {
          contextVersion: { increment: 1 },
          passwordCiphertext: null,
          passwordIv: null,
          passwordAuthTag: null,
          bearerTokenCiphertext: null,
          bearerTokenIv: null,
          bearerTokenAuthTag: null,
        },
      });

      await this.auditWriter.record(
        {
          eventType: "CREDENTIAL_REMOVED",
          result: "SUCCESS",
          actorUserId,
          targetType: "AUTHENTICATION_CONFIGURATION",
          targetId: `${apiId}:${environmentId}`,
          targetDisplay: `${api.apiName} @ ${environment.environmentName}`,
          projectId,
          beforeData: { authType, credentialConfigured: true },
          afterData: { authType, credentialConfigured: false },
        },
        tx,
      );

      return this.toResult(apiId, environmentId, saved);
    });
  }

  private validateConfigDto(dto: PutAuthenticationConfigurationDto): void {
    if (dto.authType !== "LOGIN_FORM") {
      return;
    }
    if (!dto.loginUrl) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "loginUrl is required for LOGIN_FORM");
    }
    validateLoginUrl(dto.loginUrl);
    if (!dto.username) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "username is required for LOGIN_FORM");
    }
    if (!dto.usernameField) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "usernameField is required for LOGIN_FORM");
    }
    if (!dto.passwordField) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "passwordField is required for LOGIN_FORM");
    }
    if (dto.usernameField === dto.passwordField) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        "SEMANTIC_VALIDATION_ERROR",
        "usernameField and passwordField must be different",
      );
    }
    if (!dto.tokenResponsePath) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "tokenResponsePath is required for LOGIN_FORM");
    }
    if (!TOKEN_RESPONSE_PATH_PATTERN.test(dto.tokenResponsePath)) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        "SEMANTIC_VALIDATION_ERROR",
        "tokenResponsePath must be a dot-separated path of identifier segments (e.g. access_token, data.access_token)",
      );
    }
  }

  private toResult(apiId: string, environmentId: string, row: AuthConfigRow | null): AuthenticationConfigurationResult {
    const authType = (row?.authType ?? "NONE") as AuthType;
    const secretPresent = row ? hasSecret(row) : false;
    return {
      apiId,
      environmentId,
      authType,
      credentialStatus: credentialStatusFor(authType, secretPresent),
      loginUrl: row?.loginUrl ?? null,
      username: row?.username ?? null,
      usernameField: row?.usernameField ?? null,
      passwordField: row?.passwordField ?? null,
      tokenResponsePath: row?.tokenResponsePath ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  }
}
