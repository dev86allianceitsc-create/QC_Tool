import { randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

interface RequestWithId extends Request {
  requestId?: string;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Assigns/echoes a request id as early as possible so it is available to
  // every response, including ones from the global exception filter.
  app.use((req: RequestWithId, res: Response, next: NextFunction) => {
    const incoming = req.headers["x-request-id"];
    const requestId = (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();
    req.requestId = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  });

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:8443",
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.setGlobalPrefix("api/v1");

  const swaggerConfig = new DocumentBuilder()
    .setTitle("QC Tool API")
    .setDescription("QC Tool backend API")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, swaggerDocument);

  // Nest only binds controller routes onto the underlying Express router
  // during init(), which normally runs lazily inside listen(). Calling
  // init() explicitly here binds those routes now, so the catch-all
  // middleware registered below is guaranteed to sit after them in the
  // Express middleware stack instead of shadowing every real route.
  await app.init();

  // Plain Express middleware (not a Nest route/controller), registered
  // last: catches any request that fell through every registered Nest
  // route and returns the project's standard error envelope instead of
  // Express's default HTML 404. Since this isn't a Nest-mapped route, it
  // does not appear in Nest's boot-time route log.
  app.use((req: RequestWithId, res: Response) => {
    res.status(404).json({
      errorCode: "NOT_FOUND",
      message: `Cannot ${req.method} ${req.originalUrl}`,
      details: [],
      requestId: req.requestId ?? randomUUID(),
    });
  });

  const port = Number(process.env.API_PORT) || 3000;
  await app.listen(port);
}

bootstrap();
