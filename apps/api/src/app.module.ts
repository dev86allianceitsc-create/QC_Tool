import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { SessionsModule } from "./modules/sessions/sessions.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { AuditModule } from "./modules/audit/audit.module";
import { ApiEnvironmentModule } from "./modules/api-environment/api-environment.module";
import { AuthenticationModule } from "./modules/authentication/authentication.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    SessionsModule,
    AuditModule,
    ProjectsModule,
    ApiEnvironmentModule,
    AuthenticationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
