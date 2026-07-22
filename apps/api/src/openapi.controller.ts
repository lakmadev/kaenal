import { Controller, Get, Header } from "@nestjs/common";
import { generateOpenApi } from "@ts-rest/open-api";
import { contract } from "@kaenal/types";
import { Public } from "./decorators.js";

/**
 * API visualisation (03 §1).
 *
 *  - `GET /v1/openapi.json` — the OpenAPI 3.x document, generated from the same
 *    ts-rest contract the handlers validate against and a future client is built
 *    from. It is generated, never hand-maintained, so it cannot describe an
 *    endpoint that does not exist or omit one that does.
 *  - `GET /v1/docs` — Swagger UI over that document, so the whole API can be
 *    browsed and exercised without a bespoke frontend.
 *
 * Both are `@Public`: the shape of the API is not a secret, and tooling fetches
 * it without a session. Exercising a real endpoint from Swagger still requires a
 * bearer token and the tenant header, declared below.
 */

interface OpenApiOperation {
  parameters?: unknown[];
}
interface OpenApiDocument {
  components?: Record<string, unknown>;
  security?: unknown[];
  paths: Record<string, Record<string, OpenApiOperation>>;
}

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

const TENANT_PARAM = {
  name: "X-Tenant-Id",
  in: "header",
  required: true,
  schema: { type: "string" },
  description: "Tenant slug the request is scoped to, e.g. `acme`.",
};

function buildDocument(): OpenApiDocument {
  const doc = generateOpenApi(contract, {
    info: {
      title: "Kaenal API",
      version: "0.1.0",
      description:
        "Quality & Safety Management API (multi-tenant). Every request is scoped to a tenant by " +
        "the `X-Tenant-Id` header (or subdomain), and authenticated with a bearer session token " +
        "obtained from `POST /v1/auth/sign-in`. Use **Authorize** to set the token.",
    },
  }) as unknown as OpenApiDocument;

  // Declare the bearer scheme and apply it globally so Swagger's Authorize
  // button attaches the token to every "Try it out".
  doc.components = {
    ...(doc.components ?? {}),
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
  };
  doc.security = [{ bearerAuth: [] }];

  // The tenant header is required by the lifecycle on every route but is not
  // part of the resource contract, so inject it into each operation here.
  for (const item of Object.values(doc.paths)) {
    for (const method of HTTP_METHODS) {
      const op = item[method];
      if (op !== undefined) op.parameters = [TENANT_PARAM, ...(op.parameters ?? [])];
    }
  }

  return doc;
}

const DOCUMENT = buildDocument();

const SWAGGER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kaenal API — Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/v1/openapi.json',
      dom_id: '#swagger-ui',
      persistAuthorization: true,
    });
  </script>
</body>
</html>`;

@Controller()
export class OpenApiController {
  @Public()
  @Get("v1/openapi.json")
  json(): OpenApiDocument {
    return DOCUMENT;
  }

  @Public()
  @Get("v1/docs")
  @Header("Content-Type", "text/html; charset=utf-8")
  docs(): string {
    return SWAGGER_HTML;
  }
}
