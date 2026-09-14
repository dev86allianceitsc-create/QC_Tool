import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AppService } from "./app.service";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get("health")
  @ApiOkResponse({ description: "Liveness check.", schema: { example: { status: "ok" } } })
  getHealth() {
    return this.appService.getHealth();
  }
}
