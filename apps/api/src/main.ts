import "./observability/instrument.js"; // Sentry/OTel init — must load before AppModule
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
  // nothing here. The Expo mobile app runs cross-origin ONLY in web/dev preview:
  // on localhost (simulator / desktop) AND on the machine's LAN IP when a physical
  // phone loads the PWA (e.g. http://192.168.x.x:8082 → the device must reach the
  // API at the same LAN IP). Native builds make same-process fetches with no CORS.
  // So allow-list localhost + private-LAN dev origins, never in production. Bearer
  // auth means we don't allow credentials (no cookies cross-site).
  if (env.NODE_ENV !== "production") {
    app.enableCors({
      origin: [
        /^http:\/\/localhost:\d+$/,
        /^http:\/\/127\.0\.0\.1:\d+$/,
        // Private LAN ranges (RFC1918) so a phone on the same Wi-Fi can reach the dev API.
        /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/,
        /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/,
        /^http:\/\/172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}:\d+$/,
      ],
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
