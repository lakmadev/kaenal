import { Controller, Get, Inject, Query } from "@nestjs/common";
import { z } from "zod";
import type { SearchResults } from "@kaenal/types";
import { currentTx } from "../context.js";
import { Internal } from "../decorators.js";
import { parse } from "../http/validate.js";
import { membershipOf } from "../ncr/handler-ctx.js";
import { SEARCH_SERVICE } from "../tokens.js";
import type { SearchService } from "./search.service.js";

const SearchQuery = z.object({ q: z.string().min(1).max(200) });

/**
 * Search route (03 §1, 04). Authenticated only — no capability: every INTERNAL
 * role can view the four searchable record kinds (all hold *:view), and the
 * service folds in plant scope. RLS confines every query to the caller's tenant.
 * `@Internal` keeps an external `partner` out — federated search across NCRs /
 * CAPAs / documents is not part of the supplier portal.
 */
@Internal()
@Controller()
export class SearchController {
  constructor(@Inject(SEARCH_SERVICE) private readonly search: SearchService) {}

  @Get("v1/search")
  async run(@Query() query: unknown): Promise<SearchResults> {
    const { q } = parse(SearchQuery, query);
    return this.search.search(currentTx(), membershipOf(), q);
  }
}
