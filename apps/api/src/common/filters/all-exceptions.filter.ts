import { randomUUID } from "node:crypto";
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";

const STATUS_TO_ERROR_CODE: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: "VALIDATION_ERROR",
  [HttpStatus.UNPROCESSABLE_ENTITY]: "VALIDATION_ERROR",
  [HttpStatus.UNAUTHORIZED]: "UNAUTHORIZED",
  [HttpStatus.FORBIDDEN]: "FORBIDDEN",
  [HttpStatus.NOT_FOUND]: "NOT_FOUND",
  [HttpStatus.CONFLICT]: "CONFLICT",
};

interface RequestWithId extends Request {
  requestId?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<RequestWithId>();
    const response = ctx.getResponse<Response>();
    const requestId = request.requestId ?? randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let details: unknown[] = [];
    let explicitErrorCode: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === "string") {
        message = body;
      } else if (body && typeof body === "object") {
        const { message: bodyMessage, errorCode: bodyErrorCode } = body as {
          message?: unknown;
          errorCode?: unknown;
        };
        if (Array.isArray(bodyMessage)) {
          // class-validator's ValidationPipe reports one string per failed rule.
          message = "Validation failed";
          details = bodyMessage;
        } else if (typeof bodyMessage === "string") {
          message = bodyMessage;
        } else {
          message = exception.message;
        }
        if (typeof bodyErrorCode === "string") {
          // e.g. BusinessException — an explicit business error code takes
          // precedence over the generic HTTP-status-keyed map below.
          explicitErrorCode = bodyErrorCode;
        }
      }
    }

    const errorCode =
      explicitErrorCode ?? STATUS_TO_ERROR_CODE[status] ?? (status >= 500 ? "INTERNAL_ERROR" : "ERROR");

    if (status >= 500) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.originalUrl} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      errorCode,
      message,
      details,
      requestId,
    });
  }
}
