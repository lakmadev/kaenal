import { Body, Controller, Get, HttpCode, Inject, Post } from "@nestjs/common";
import {
  authorize,
  getQuerySource,
  hasCapability,
  QUERY_SOURCES,
  toQuerySourceDto,
  type Membership,
} from "@kaenal/core";
import {
  Query as QuerySchema,
  type Query,
  type QueryMetricResult,
  type QueryRowsResult,
  type QuerySeriesResult,
  type QuerySourceDto,
} from "@kaenal/types";
import { currentContext, currentTx } from "../context.js";
import { Internal } from "../decorators.js";
import { ApiError } from "../errors.js";
import { parse } from "../http/validate.js";
import { QUERY_SERVICE } from "../tokens.js";
import type { QueryService } from "./query.service.js";

/**
 * The query engine's public surface (Part B2). Every route is `@Internal` (a
 * supplier-portal partner has no data-platform capability) and authenticated,
 * but the capability check is **dynamic**: a `Query` names its `sourceId`, so
 * the gate is "does this role hold the source's `*:view` capability" (B6),
 * resolved per request rather than by a static `@RequireCapability`. RLS scopes
 * every statement to the tenant regardless of role.
 */
@Internal()
@Controller()
export class QueryController {
  constructor(@Inject(QUERY_SERVICE) private readonly query: QueryService) {}

  /** The sources this caller may query — the report builder's source picker. */
  @Get("v1/query/sources")
  sources(): { items: QuerySourceDto[] } {
    const membership = requireMembership();
    const items = Object.values(QUERY_SOURCES)
      .filter((s) => hasCapability(membership.role, s.capability))
      .map(toQuerySourceDto);
    return { items };
  }

  @Post("v1/query")
  @HttpCode(200)
  async rows(@Body() body: unknown): Promise<QueryRowsResult> {
    return this.query.runRows(currentTx(), authorizeQuery(parse(QuerySchema, body)));
  }

  @Post("v1/query/metric")
  @HttpCode(200)
  async metric(@Body() body: unknown): Promise<QueryMetricResult> {
    return this.query.runMetric(currentTx(), authorizeQuery(parse(QuerySchema, body)));
  }

  @Post("v1/query/series")
  @HttpCode(200)
  async series(@Body() body: unknown): Promise<QuerySeriesResult> {
    return this.query.runSeries(currentTx(), authorizeQuery(parse(QuerySchema, body)));
  }
}

function requireMembership(): Membership {
  const { membership } = currentContext();
  // Unreachable on an authenticated route (default-deny), but the type is
  // nullable, so fail loud rather than assume.
  if (membership === null) throw new ApiError("UNAUTHENTICATED", "Authentication required");
  return membership;
}

/**
 * Resolves the query's source and enforces its capability BEFORE the query runs
 * (B6). An unknown source is a 422 (client error, not tenant data — no rule-8
 * concern); a known source the role can't view is a 403 carrying the missing
 * capability, exactly as `@RequireCapability` would.
 */
function authorizeQuery(query: Query): Query {
  const source = getQuerySource(query.sourceId);
  if (source === undefined) {
    throw new ApiError("VALIDATION_FAILED", `Unknown data source '${query.sourceId}'`);
  }
  const decision = authorize(requireMembership(), source.capability);
  if (!decision.ok) throw ApiError.from(decision);
  return query;
}
