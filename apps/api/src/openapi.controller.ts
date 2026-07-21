import { Controller, Get } from "@nestjs/common";
import { generateOpenApi } from "@ts-rest/open-api";
import { contract } from "@kaenal/types";
import { Public } from "./decorators.js";

/**
 * `GET /v1/openapi.json` (03 §1) — the OpenAPI 3.x document, generated from the
 * same ts-rest contract the handlers validate against and the client is built
 * from. It is generated, never hand-maintained, so it cannot describe an
 * endpoint that does not exist or omit one that does.
 *
 * Public: the schema of the API is not a secret, and tooling (Swagger UI, code
 * generators) fetches it without a session.
 */
const document = generateOpenApi(contract, {
  info: {
    title: "Kaenal API",
    version: "0.1.0",
    description: "Quality & Safety Management API (multi-tenant, tenant resolved by subdomain or X-Tenant-Id).",
  },
});

@Controller()
export class OpenApiController {
  @Public()
  @Get("v1/openapi.json")
  get(): unknown {
    return document;
  }
}
