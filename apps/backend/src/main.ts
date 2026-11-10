import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { createValidationPipe } from "./common/validation.pipe";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix("api");
  app.useGlobalPipes(createValidationPipe());
  app.enableCors({
    origin: config.get<string>("FRONTEND_ORIGIN", "http://localhost:3000"),
  });
  app.enableShutdownHooks();

  await app.listen(Number(config.get<string>("PORT", "3001")));
}

bootstrap().catch((error: unknown) => {
  Logger.error(error, "Bootstrap");
  process.exitCode = 1;
});
