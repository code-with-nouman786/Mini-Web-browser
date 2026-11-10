import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  getStatus(): { status: string; service: string } {
    return { status: "ok", service: "wyxan-api" };
  }
}
