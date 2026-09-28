import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { z } from "zod";
import { EntityKind, GraphQueryId, type GraphExpandResult, type GraphQueryResult, type GraphSeedsResult } from "@kaenal/types";
import { currentTx } from "../context.js";
import { Internal, RequireCapability } from "../decorators.js";
import { parse } from "../http/validate.js";
import { membershipOf } from "../ncr/handler-ctx.js";
import { GRAPH_SERVICE } from "../tokens.js";
import type { GraphService } from "./graph.service.js";

const expandQuery = z.object({
  seed: z.string().min(1),
  type: EntityKind.optional(),
  after: z.string().optional(),
});

const queryQuery = z.object({ focus: z.string().optional() });
const queryParams = z.object({ queryId: GraphQueryId });

/**
 * Knowledge graph explorer (Sprint 03 G1-G4; `graph-explorer.jsx`). `@Internal`
 * — this is not a supplier-portal surface. `graph:view` required on both
 * routes (admin/manager/auditor, mirroring `ROLE_NAV`'s existing web curation
 * — inspector/viewer never reach either route, deep-link or not).
 */
@Internal()
@Controller()
@RequireCapability("graph:view")
export class GraphController {
  constructor(@Inject(GRAPH_SERVICE) private readonly graph: GraphService) {}

  @Get("v1/graph/seeds")
  async seeds(): Promise<GraphSeedsResult> {
    return this.graph.listSeeds(currentTx(), membershipOf());
  }

  @Get("v1/graph/expand")
  async expand(@Query() query: unknown): Promise<GraphExpandResult> {
    const { seed, type, after } = parse(expandQuery, query);
    return this.graph.expand(currentTx(), membershipOf(), seed, type, after);
  }

  @Get("v1/graph/query/:queryId")
  async query(@Param() params: unknown, @Query() query: unknown): Promise<GraphQueryResult> {
    const { queryId } = parse(queryParams, params);
    const { focus } = parse(queryQuery, query);
    return this.graph.query(currentTx(), membershipOf(), queryId, focus);
  }
}
