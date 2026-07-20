import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { loadEnv } from "./env.js";

/**
 * Bootstrap.
 *
 * Env is parsed before the Nest container is built so that a misconfigured
 * deploy fails here, not on a customer's first request (01 §2).
 */
async function bootstrap(): Promise<void> {
  const env = loadEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // The error envelope filter owns all error responses (03 §4).
    logger: env.LOG_LEVEL === "debug" ? ["log", "error", "warn", "debug"] : ["log", "error", "warn"],
  });

  // Behind a load balancer, req.ip must come from X-Forwarded-For — it is
  // recorded on every audit event, so getting it wrong makes the trail wrong.
  app.set("trust proxy", 1);

  app.enableShutdownHooks();

  await app.listen(env.PORT);
  new Logger("Bootstrap").log(`API listening on :${env.PORT}`);
}

void bootstrap();
