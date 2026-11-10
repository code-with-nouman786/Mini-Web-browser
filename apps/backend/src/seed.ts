import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SeedModule } from "./seed/seed.module";
import { SeedService } from "./seed/seed.service";

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SeedModule);
  try {
    const counts = await app.get(SeedService).seed();
    Logger.log(`Seed complete: ${JSON.stringify(counts)}`, "Seed");
  } finally {
    await app.close();
  }
}

seed().catch((error: unknown) => {
  Logger.error(error, "Seed");
  process.exitCode = 1;
});
