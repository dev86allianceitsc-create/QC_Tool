import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";
import { encryptSecret } from "../../common/utils/credential-crypto";
import { AuditWriterService } from "../audit/audit-writer.service";
import { assertProjectActive } from "../api-environment/apis.service";
import {
  PutAuthenticationConfigurationDto,
  AuthTypeValue,
  LoginModeValue,
  ImportBodyFormatValue,
  KeyValueEntryDto,
  FieldLocationDto,
} from "./dto/put-authentication-configuration.dto";
import { PutCredentialDto } from "./dto/put-credential.dto";
import { isSupportedHttpMethod } from "../api-environment/http-method.constants";

export type AuthType = AuthTypeValue;
export type CredentialStatus = "NOT_REQUIRED" | "CONFIGURED" | "NOT_CONFIGURED";

// REVISION 3C-R02 — Authentication is now managed once per Environment (in
// Project Settings), shared by every API run against it. Login Form's
// identity/secret lives on the separate TestAccount model instead of on this
// row; credentialStatus for LOGIN_FORM reflects whether at least one Test
// Account exists, not a password on this row.
export interface AuthenticationConfigurationResult {
  environmentId: string;
  authType: AuthType;
  credentialStatus: CredentialStatus;
  loginMode: LoginModeValue | null;
  loginUrl: string | null;
  usernameField: string | null;
  passwordField: string | null;
  importMethod: string | null;
  importUrl: string | null;
  importHeaders: KeyValueEntryDto[] | null;
  importBodyFormat: ImportBodyFormatValue | null;
  importBodyFields: KeyValueEntryDto[] | null;
  importUsernameLocation: FieldLocationDto | null;
  importPasswordLocation: FieldLocationDto | null;
  updatedAt: Date | null;
}

interface AuthConfigRow {
  authType: string;
  loginMode: string | null;
  loginUrl: string | null;
  usernameField: string | null;
  passwordField: string | null;
  importMethod: string | null;
  importUrl: string | null;
  importHeaders: Prisma.JsonValue | null;
  importBodyFormat: string | null;
  importBodyFields: Prisma.JsonValue | null;
  importUsernameLocation: Prisma.JsonValue | null;
  importPasswordLocation: Prisma.JsonValue | null;
  updatedAt: Date;
  bearerTokenCiphertext: Uint8Array | null;
}

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

function findLocationTarget(location: FieldLocationDto, headers: KeyValueEntryDto[], bodyFields: KeyValueEntryDto[]): boolean {
  const pool = location.kind === "HEADER" ? headers : bodyFields;
  return pool.some((entry) => entry.name === location.name);
}

function jsonOrDbNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value === undefined || value === null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

function hasBearerToken(row: { bearerTokenCiphertext: Uint8Array | null }): boolean {
  return row.bearerTokenCiphertext !== null;
}

function credentialStatusFor(authType: AuthType, secretPresent: boolean): CredentialStatus {
  if (authType === "NONE") {
    return "NOT_REQUIRED";
  }
  return secretPresent ? "CONFIGURED" : "NOT_CONFIGURED";
}

async function findEnvironment(
  prisma: Prisma.TransactionClient | PrismaService,
  projectId: string,
  environmentId: string,
): Promise<{ environmentId: string; environmentName: string; environmentStatus: string }> {
  const environment = await prisma.environment.findFirst({ where: { environmentId, projectId } });
  if (!environment) {
    throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Environment does not exist");
  }
  return environment;
}

async function countTestAccountsIfLoginForm(
  prisma: Prisma.TransactionClient | PrismaService,
  environmentId: string,
  authType: string,
): Promise<number> {
  if (authType !== "LOGIN_FORM") {
    return 0;
  }
  return prisma.testAccount.count({ where: { environmentId } });
}

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  async get(projectId: string, environmentId: string): Promise<AuthenticationConfigurationResult> {
    await findEnvironment(this.prisma, projectId, environmentId);
    const row = await this.prisma.authenticationConfiguration.findUnique({ where: { environmentId } });
    const testAccountCount = await countTestAccountsIfLoginForm(this.prisma, environmentId, row?.authType ?? "NONE");
    return this.toResult(environmentId, row, testAccountCount);
  }

  async putConfiguration(
    projectId: string,
    environmentId: string,
    dto: PutAuthenticationConfigurationDto,
    actorUserId: string,
  ): Promise<AuthenticationConfigurationResult> {
    this.validateConfigDto(dto);

    return this.prisma.$transaction(async (tx) => {
      await assertProjectActive(tx, projectId);
      const environment = await findEnvironment(tx, projectId, environmentId);
      if (environment.environmentStatus !== "ACTIVE") {
        throw new BusinessException(HttpStatus.CONFLICT, "INVALID_STATE", "Environment is not ACTIVE");
      }

      const existing = await tx.authenticationConfiguration.findUnique({ where: { environmentId } });
      const previousAuthType = (existing?.authType ?? "NONE") as AuthType;
      const typeChanged = previousAuthType !== dto.authType;

      // context_version (Group 5 Q5 answer): a brand-new row always starts at
      // 1, never "increments". On an existing row, it advances only when
      // auth_type itself changes — identity for LOGIN_FORM now lives on
      // TestAccount, which is deliberately excluded from this version
      // (different Test Accounts must share a fingerprint). Technical-field-
      // only edits (loginMode, loginUrl, usernameField, passwordField, and
      // every import* field below) never increment on their own — only a
      // change of auth_type itself does.
      const contextVersion = existing === null ? 1 : typeChanged ? existing.contextVersion + 1 : existing.contextVersion;

      const isManualLoginForm = dto.authType === "LOGIN_FORM" && dto.loginMode === "MANUAL";
      const isImportedLoginForm = dto.authType === "LOGIN_FORM" && dto.loginMode === "IMPORTED";

      // Preserving-on-switch (not REQ-AUTH-003/CL-3C-02 anymore): authType/
      // loginMode only select which shape is *active*. Any field belonging to
      // an inactive shape is carried forward from the existing row instead of
      // being nulled, so switching away and back restores it untouched.
      // Deleting configuration is only ever done via an explicit action
      // (DELETE /credential, DELETE /test-accounts/:id), never as a side
      // effect of this mutation.
      const data: Prisma.AuthenticationConfigurationUncheckedCreateInput = {
        environmentId,
        authType: dto.authType,
        contextVersion,
        loginMode: dto.authType === "LOGIN_FORM" ? (dto.loginMode ?? null) : (existing?.loginMode ?? null),
        loginUrl: isManualLoginForm ? (dto.loginUrl ?? null) : (existing?.loginUrl ?? null),
        usernameField: isManualLoginForm ? (dto.usernameField ?? null) : (existing?.usernameField ?? null),
        passwordField: isManualLoginForm ? (dto.passwordField ?? null) : (existing?.passwordField ?? null),
        importMethod: isImportedLoginForm ? (dto.importMethod ?? null) : (existing?.importMethod ?? null),
        importUrl: isImportedLoginForm ? (dto.importUrl ?? null) : (existing?.importUrl ?? null),
        importHeaders: isImportedLoginForm ? jsonOrDbNull(dto.importHeaders ?? []) : jsonOrDbNull(existing?.importHeaders ?? null),
        importBodyFormat: isImportedLoginForm ? (dto.importBodyFormat ?? null) : (existing?.importBodyFormat ?? null),
        importBodyFields: isImportedLoginForm ? jsonOrDbNull(dto.importBodyFields ?? []) : jsonOrDbNull(existing?.importBodyFields ?? null),
        importUsernameLocation: isImportedLoginForm ? jsonOrDbNull(dto.importUsernameLocation) : jsonOrDbNull(existing?.importUsernameLocation ?? null),
        importPasswordLocation: isImportedLoginForm ? jsonOrDbNull(dto.importPasswordLocation) : jsonOrDbNull(existing?.importPasswordLocation ?? null),
      };
      // bearerToken* columns are intentionally absent from `data`: this
      // mutation never touches them, changed or not — only putCredential/
      // removeCredential do.

      const saved = await tx.authenticationConfiguration.upsert({
        where: { environmentId },
        create: data,
        update: data,
      });

      // Test Accounts are never deleted by this mutation, so the same real
      // row count applies both before and after the switch — unlike
      // countTestAccountsIfLoginForm (used elsewhere to skip the query when
      // it can't matter for the *current* authType), this must not gate on
      // saved.authType alone, since previousAuthType and saved.authType can
      // differ across a switch.
      const testAccountCount =
        previousAuthType === "LOGIN_FORM" || saved.authType === "LOGIN_FORM" ? await tx.testAccount.count({ where: { environmentId } }) : 0;

      const beforeSecretPresent =
        previousAuthType === "BEARER_TOKEN"
          ? existing
            ? hasBearerToken(existing)
            : false
          : previousAuthType === "LOGIN_FORM"
            ? testAccountCount > 0
            : false;
      const afterSecretPresent =
        saved.authType === "BEARER_TOKEN" ? hasBearerToken(saved) : saved.authType === "LOGIN_FORM" ? testAccountCount > 0 : false;

      await this.auditWriter.record(
        {
          eventType: typeChanged ? "AUTH_TYPE_CHANGED" : "AUTHENTICATION_CONFIGURATION_UPDATED",
          result: "SUCCESS",
          actorUserId,
          targetType: "AUTHENTICATION_CONFIGURATION",
          targetId: environmentId,
          targetDisplay: environment.environmentName,
          projectId,
          beforeData: { authType: previousAuthType, credentialConfigured: beforeSecretPresent },
          afterData: { authType: saved.authType, credentialConfigured: afterSecretPresent },
        },
        tx,
      );

      return this.toResult(environmentId, saved, testAccountCount);
    });
  }

  async putCredential(
    projectId: string,
    environmentId: string,
    dto: PutCredentialDto,
    actorUserId: string,
  ): Promise<AuthenticationConfigurationResult> {
    return this.prisma.$transaction(async (tx) => {
      await assertProjectActive(tx, projectId);
      const environment = await findEnvironment(tx, projectId, environmentId);
      if (environment.environmentStatus !== "ACTIVE") {
        throw new BusinessException(HttpStatus.CONFLICT, "INVALID_STATE", "Environment is not ACTIVE");
      }

      const existing = await tx.authenticationConfiguration.findUnique({ where: { environmentId } });
      const authType = (existing?.authType ?? "NONE") as AuthType;
      if (authType === "NONE" || !existing) {
        throw new BusinessException(
          HttpStatus.CONFLICT,
          "INVALID_STATE",
          "Authentication type is NONE; no credential can be configured",
        );
      }
      if (authType === "LOGIN_FORM") {
        throw new BusinessException(
          HttpStatus.CONFLICT,
          "INVALID_STATE",
          "LOGIN_FORM credentials are managed via Test Accounts, not this endpoint",
        );
      }

      if (!dto.token) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "token is required for BEARER_TOKEN");
      }
      const normalizedToken = dto.token.replace(/^Bearer\s+/i, "").trim();
      if (!normalizedToken) {
        throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "token must not be empty");
      }
      const encrypted = encryptSecret(normalizedToken);
      let updateData: Prisma.AuthenticationConfigurationUpdateInput = {
        bearerTokenCiphertext: encrypted.ciphertext,
        bearerTokenIv: encrypted.iv,
        bearerTokenAuthTag: encrypted.authTag,
      };

      const wasConfigured = hasBearerToken(existing);

      // context_version (Group 5 Q5 answer). BEARER_TOKEN is opaque: a
      // replacement increments by default (new context) unless the config
      // owner explicitly confirms sameIdentity. The very first credential
      // ever set on this row never increments here — there is nothing to
      // compare it against, and putConfiguration already counted any
      // type-change that made a credential possible in the first place.
      if (wasConfigured && dto.sameIdentity !== true) {
        updateData = { ...updateData, contextVersion: { increment: 1 } };
      }

      const saved = await tx.authenticationConfiguration.update({
        where: { environmentId },
        data: updateData,
      });

      await this.auditWriter.record(
        {
          eventType: wasConfigured ? "CREDENTIAL_REPLACED" : "CREDENTIAL_CONFIGURED",
          result: "SUCCESS",
          actorUserId,
          targetType: "AUTHENTICATION_CONFIGURATION",
          targetId: environmentId,
          targetDisplay: environment.environmentName,
          projectId,
          beforeData: { authType, credentialConfigured: wasConfigured },
          afterData: { authType, credentialConfigured: true },
        },
        tx,
      );

      return this.toResult(environmentId, saved, 0);
    });
  }

  async removeCredential(projectId: string, environmentId: string, actorUserId: string): Promise<AuthenticationConfigurationResult> {
    return this.prisma.$transaction(async (tx) => {
      await assertProjectActive(tx, projectId);
      const environment = await findEnvironment(tx, projectId, environmentId);
      if (environment.environmentStatus !== "ACTIVE") {
        throw new BusinessException(HttpStatus.CONFLICT, "INVALID_STATE", "Environment is not ACTIVE");
      }

      const existing = await tx.authenticationConfiguration.findUnique({ where: { environmentId } });
      const authType = (existing?.authType ?? "NONE") as AuthType;

      if (!existing || !hasBearerToken(existing)) {
        // Idempotent: already Not configured (or LOGIN_FORM, which has no
        // secret on this row) — no state change, no audit noise.
        const testAccountCount = await countTestAccountsIfLoginForm(tx, environmentId, authType);
        return this.toResult(environmentId, existing, testAccountCount);
      }

      // context_version (Group 5 Q5 answer): access materially changed to
      // NOT_CONFIGURED, so this counts as an identity/access change.
      const saved = await tx.authenticationConfiguration.update({
        where: { environmentId },
        data: {
          contextVersion: { increment: 1 },
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
          targetId: environmentId,
          targetDisplay: environment.environmentName,
          projectId,
          beforeData: { authType, credentialConfigured: true },
          afterData: { authType, credentialConfigured: false },
        },
        tx,
      );

      return this.toResult(environmentId, saved, 0);
    });
  }

  private validateConfigDto(dto: PutAuthenticationConfigurationDto): void {
    if (dto.authType !== "LOGIN_FORM") {
      return;
    }
    if (!dto.loginMode) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "loginMode is required for LOGIN_FORM");
    }
    if (dto.loginMode === "MANUAL") {
      this.validateManualLoginForm(dto);
      return;
    }
    this.validateImportedLoginForm(dto);
  }

  private validateManualLoginForm(dto: PutAuthenticationConfigurationDto): void {
    if (!dto.loginUrl) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "loginUrl is required for LOGIN_FORM");
    }
    validateLoginUrl(dto.loginUrl);
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
  }

  private validateImportedLoginForm(dto: PutAuthenticationConfigurationDto): void {
    if (!dto.importUrl) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "importUrl is required for LOGIN_FORM/IMPORTED");
    }
    validateLoginUrl(dto.importUrl);

    if (!dto.importMethod || !isSupportedHttpMethod(dto.importMethod)) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        "SEMANTIC_VALIDATION_ERROR",
        "importMethod must be one of the supported HTTP methods (GET, POST, PUT, PATCH, DELETE)",
      );
    }

    if (!dto.importBodyFormat) {
      throw new BusinessException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "importBodyFormat is required for LOGIN_FORM/IMPORTED");
    }

    const headers = dto.importHeaders ?? [];
    const bodyFields = dto.importBodyFields ?? [];

    if (dto.importBodyFormat !== "NONE" && bodyFields.length === 0) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        "SEMANTIC_VALIDATION_ERROR",
        "importBodyFields is required when importBodyFormat is not NONE",
      );
    }

    if (!dto.importUsernameLocation) {
      throw new BusinessException(
        HttpStatus.BAD_REQUEST,
        "VALIDATION_ERROR",
        "importUsernameLocation is required for LOGIN_FORM/IMPORTED",
      );
    }
    if (!dto.importPasswordLocation) {
      throw new BusinessException(
        HttpStatus.BAD_REQUEST,
        "VALIDATION_ERROR",
        "importPasswordLocation is required for LOGIN_FORM/IMPORTED",
      );
    }
    if (
      dto.importUsernameLocation.kind === dto.importPasswordLocation.kind &&
      dto.importUsernameLocation.name === dto.importPasswordLocation.name
    ) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        "SEMANTIC_VALIDATION_ERROR",
        "importUsernameLocation and importPasswordLocation must be different",
      );
    }
    if (!findLocationTarget(dto.importUsernameLocation, headers, bodyFields)) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        "SEMANTIC_VALIDATION_ERROR",
        "importUsernameLocation does not reference an imported header or body field",
      );
    }
    if (!findLocationTarget(dto.importPasswordLocation, headers, bodyFields)) {
      throw new BusinessException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        "SEMANTIC_VALIDATION_ERROR",
        "importPasswordLocation does not reference an imported header or body field",
      );
    }
  }

  private toResult(environmentId: string, row: AuthConfigRow | null, testAccountCount: number): AuthenticationConfigurationResult {
    const authType = (row?.authType ?? "NONE") as AuthType;
    const secretPresent = !row ? false : authType === "BEARER_TOKEN" ? hasBearerToken(row) : authType === "LOGIN_FORM" ? testAccountCount > 0 : false;
    return {
      environmentId,
      authType,
      credentialStatus: credentialStatusFor(authType, secretPresent),
      loginMode: (row?.loginMode ?? null) as LoginModeValue | null,
      loginUrl: row?.loginUrl ?? null,
      usernameField: row?.usernameField ?? null,
      passwordField: row?.passwordField ?? null,
      importMethod: row?.importMethod ?? null,
      importUrl: row?.importUrl ?? null,
      importHeaders: (row?.importHeaders ?? null) as KeyValueEntryDto[] | null,
      importBodyFormat: (row?.importBodyFormat ?? null) as ImportBodyFormatValue | null,
      importBodyFields: (row?.importBodyFields ?? null) as KeyValueEntryDto[] | null,
      importUsernameLocation: (row?.importUsernameLocation ?? null) as FieldLocationDto | null,
      importPasswordLocation: (row?.importPasswordLocation ?? null) as FieldLocationDto | null,
      updatedAt: row?.updatedAt ?? null,
    };
  }
}
