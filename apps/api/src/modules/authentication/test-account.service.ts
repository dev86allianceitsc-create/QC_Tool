import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { BusinessException } from "../../common/exceptions/business.exception";
import { encryptSecret } from "../../common/utils/credential-crypto";
import { AuditWriterService } from "../audit/audit-writer.service";
import { assertProjectActive, isUniqueConstraintError } from "../api-environment/apis.service";
import { CreateTestAccountDto } from "./dto/create-test-account.dto";
import { UpdateTestAccountDto } from "./dto/update-test-account.dto";

// test_accounts — REVISION 3C-R02. Named Login Form credentials saved per
// Environment (0..N). Only meaningful while the Environment's Authentication
// is LOGIN_FORM; every method below is gated on that, mirroring the
// Authentication module's own INVALID_STATE gating. Password is write-only —
// never echoed back by any response here.
export interface TestAccountResult {
  testAccountId: string;
  environmentId: string;
  label: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
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

@Injectable()
export class TestAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  async list(projectId: string, environmentId: string): Promise<TestAccountResult[]> {
    await findEnvironment(this.prisma, projectId, environmentId);
    await this.assertLoginForm(this.prisma, environmentId);
    const rows = await this.prisma.testAccount.findMany({ where: { environmentId }, orderBy: { label: "asc" } });
    return rows.map((row) => this.toResult(row));
  }

  async create(projectId: string, environmentId: string, dto: CreateTestAccountDto, actorUserId: string): Promise<TestAccountResult> {
    return this.prisma.$transaction(async (tx) => {
      await assertProjectActive(tx, projectId);
      const environment = await findEnvironment(tx, projectId, environmentId);
      if (environment.environmentStatus !== "ACTIVE") {
        throw new BusinessException(HttpStatus.CONFLICT, "INVALID_STATE", "Environment is not ACTIVE");
      }
      await this.assertLoginForm(tx, environmentId);

      const encrypted = encryptSecret(dto.password);
      let created;
      try {
        created = await tx.testAccount.create({
          data: {
            environmentId,
            label: dto.label,
            username: dto.username,
            passwordCiphertext: encrypted.ciphertext,
            passwordIv: encrypted.iv,
            passwordAuthTag: encrypted.authTag,
          },
        });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          throw new BusinessException(HttpStatus.CONFLICT, "TEST_ACCOUNT_LABEL_EXISTS", "A Test Account with this label already exists in this Environment");
        }
        throw err;
      }

      await this.auditWriter.record(
        {
          eventType: "TEST_ACCOUNT_CREATED",
          result: "SUCCESS",
          actorUserId,
          targetType: "TEST_ACCOUNT",
          targetId: created.testAccountId,
          targetDisplay: created.label,
          projectId,
          afterData: { environmentId, label: created.label, username: created.username },
        },
        tx,
      );

      return this.toResult(created);
    });
  }

  async update(
    projectId: string,
    environmentId: string,
    testAccountId: string,
    dto: UpdateTestAccountDto,
    actorUserId: string,
  ): Promise<TestAccountResult> {
    return this.prisma.$transaction(async (tx) => {
      await assertProjectActive(tx, projectId);
      const environment = await findEnvironment(tx, projectId, environmentId);
      if (environment.environmentStatus !== "ACTIVE") {
        throw new BusinessException(HttpStatus.CONFLICT, "INVALID_STATE", "Environment is not ACTIVE");
      }
      await this.assertLoginForm(tx, environmentId);

      const existing = await tx.testAccount.findFirst({ where: { testAccountId, environmentId } });
      if (!existing) {
        throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Test Account does not exist in this Environment");
      }

      const beforeData: Record<string, unknown> = { label: existing.label, username: existing.username };
      const data: {
        label?: string;
        username?: string;
        passwordCiphertext?: Uint8Array<ArrayBuffer>;
        passwordIv?: Uint8Array<ArrayBuffer>;
        passwordAuthTag?: Uint8Array<ArrayBuffer>;
      } = {};
      if (dto.label !== undefined) {
        data.label = dto.label;
      }
      if (dto.username !== undefined) {
        data.username = dto.username;
      }
      if (dto.password !== undefined) {
        const encrypted = encryptSecret(dto.password);
        data.passwordCiphertext = encrypted.ciphertext;
        data.passwordIv = encrypted.iv;
        data.passwordAuthTag = encrypted.authTag;
      }

      let updated;
      try {
        updated = await tx.testAccount.update({ where: { testAccountId }, data });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          throw new BusinessException(HttpStatus.CONFLICT, "TEST_ACCOUNT_LABEL_EXISTS", "A Test Account with this label already exists in this Environment");
        }
        throw err;
      }

      await this.auditWriter.record(
        {
          eventType: "TEST_ACCOUNT_UPDATED",
          result: "SUCCESS",
          actorUserId,
          targetType: "TEST_ACCOUNT",
          targetId: testAccountId,
          targetDisplay: updated.label,
          projectId,
          beforeData,
          afterData: { label: updated.label, username: updated.username },
        },
        tx,
      );

      return this.toResult(updated);
    });
  }

  async remove(projectId: string, environmentId: string, testAccountId: string, actorUserId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await assertProjectActive(tx, projectId);
      const environment = await findEnvironment(tx, projectId, environmentId);
      if (environment.environmentStatus !== "ACTIVE") {
        throw new BusinessException(HttpStatus.CONFLICT, "INVALID_STATE", "Environment is not ACTIVE");
      }
      await this.assertLoginForm(tx, environmentId);

      const existing = await tx.testAccount.findFirst({ where: { testAccountId, environmentId } });
      if (!existing) {
        throw new BusinessException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Test Account does not exist in this Environment");
      }

      await tx.testAccount.delete({ where: { testAccountId } });

      await this.auditWriter.record(
        {
          eventType: "TEST_ACCOUNT_REMOVED",
          result: "SUCCESS",
          actorUserId,
          targetType: "TEST_ACCOUNT",
          targetId: testAccountId,
          targetDisplay: existing.label,
          projectId,
          beforeData: { environmentId, label: existing.label, username: existing.username },
        },
        tx,
      );
    });
  }

  private async assertLoginForm(prisma: Prisma.TransactionClient | PrismaService, environmentId: string): Promise<void> {
    const authConfig = await prisma.authenticationConfiguration.findUnique({ where: { environmentId } });
    if (authConfig?.authType !== "LOGIN_FORM") {
      throw new BusinessException(
        HttpStatus.CONFLICT,
        "INVALID_STATE",
        "Authentication type is not LOGIN_FORM; Test Accounts are not applicable",
      );
    }
  }

  private toResult(row: { testAccountId: string; environmentId: string; label: string; username: string; createdAt: Date; updatedAt: Date }): TestAccountResult {
    return {
      testAccountId: row.testAccountId,
      environmentId: row.environmentId,
      label: row.label,
      username: row.username,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
