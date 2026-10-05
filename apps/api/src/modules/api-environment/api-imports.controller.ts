import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ProjectAccessGuard } from "../../common/guards/project-access.guard";
import { SessionGuard } from "../../common/guards/session.guard";
import { ApiImportsService, ImportOutcome, PreviewImportResult } from "./api-imports.service";
import { ApiDetail } from "./apis.service";
import { ImportCurlFetchDto } from "./dto/import-curl-fetch.dto";
import { ImportOpenApiDto } from "./dto/import-openapi.dto";
import { UploadedMulterFile } from "./uploaded-file.type";

function requireFile(file: UploadedMulterFile | undefined): UploadedMulterFile {
  if (!file) {
    throw new BadRequestException({ errorCode: "VALIDATION_ERROR", message: "A Swagger/OpenAPI specification file is required" });
  }
  return file;
}

@ApiTags("api-imports")
@Controller("projects/:projectId/api-imports")
@UseGuards(SessionGuard, ProjectAccessGuard)
@ApiBearerAuth()
export class ApiImportsController {
  constructor(private readonly apiImportsService: ApiImportsService) {}

  @Post("preview")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ operationId: "previewOpenApiImport", summary: "Preview a Swagger/OpenAPI file: parse and classify candidates, no persistence (API-API-006)" })
  @ApiResponse({ status: 200, description: "Parsed candidates with VALID/DUPLICATE/INVALID classification" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 422, description: "OPENAPI_PARSE_ERROR" })
  @HttpCode(HttpStatus.OK)
  async preview(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @UploadedFile() file: UploadedMulterFile | undefined,
  ): Promise<PreviewImportResult> {
    return this.apiImportsService.preview(projectId, requireFile(file));
  }

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ operationId: "importOpenApiEndpoints", summary: "Confirm import of selected candidates from a Swagger/OpenAPI file (API-API-007)" })
  @ApiResponse({ status: 201, description: "Import outcome per selected candidate" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 422, description: "OPENAPI_PARSE_ERROR" })
  @HttpCode(HttpStatus.CREATED)
  async confirmImport(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @UploadedFile() file: UploadedMulterFile | undefined,
    @Body() dto: ImportOpenApiDto,
    @CurrentUser() userId: string,
  ): Promise<ImportOutcome> {
    return this.apiImportsService.confirmImport(projectId, requireFile(file), dto, userId);
  }

  @Post("curl-fetch")
  @ApiOperation({ operationId: "importApiFromCurlFetch", summary: "Create an API and its Request Input from a parsed curl/fetch command" })
  @ApiResponse({ status: 201, description: "Created API, with its Request Input persisted in the same transaction" })
  @ApiResponse({ status: 400, description: "VALIDATION_ERROR" })
  @ApiResponse({ status: 401, description: "SESSION_INVALID / SESSION_EXPIRED / SESSION_REVOKED" })
  @ApiResponse({ status: 403, description: "PROJECT_ACCESS_DENIED" })
  @ApiResponse({ status: 404, description: "NOT_FOUND" })
  @ApiResponse({ status: 409, description: "API_ALREADY_EXISTS" })
  @ApiResponse({ status: 422, description: "SEMANTIC_VALIDATION_ERROR" })
  @HttpCode(HttpStatus.CREATED)
  async importCurlFetch(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: ImportCurlFetchDto,
    @CurrentUser() userId: string,
  ): Promise<ApiDetail> {
    return this.apiImportsService.importFromCurlFetch(projectId, dto, userId);
  }
}
