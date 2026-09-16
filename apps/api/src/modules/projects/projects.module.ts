import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ProjectMembersController } from "./project-members.controller";
import { ProjectMembersService } from "./project-members.service";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

@Module({
  imports: [AuditModule],
  controllers: [ProjectsController, ProjectMembersController],
  providers: [ProjectsService, ProjectMembersService],
})
export class ProjectsModule {}
