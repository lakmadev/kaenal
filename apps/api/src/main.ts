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

  // CORS. The web app is same-origin (its dev server proxies /api), so it needs
  // nothing here. The Expo mobile app runs cross-origin ONLY in web/dev preview
  // (localhost:8081/8082); native builds make same-process fetches with no CORS at
  // all. So enable a tight allow-list for localhost dev origins, never in
  // production. Bearer auth means we don't allow credentials (no cookies cross-site).
  if (env.NODE_ENV !== "production") {
    app.enableCors({
      origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["content-type", "authorization", "x-tenant-id", "x-auth-mode", "idempotency-key"],
      credentials: false,
    });
  }

  app.enableShutdownHooks();

  await app.listen(env.PORT);
  new Logger("Bootstrap").log(`API listening on :${env.PORT}`);
}

void bootstrap();
