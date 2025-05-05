import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "chat-api",
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }
}
