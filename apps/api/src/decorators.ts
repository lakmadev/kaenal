import { SetMetadata } from "@nestjs/common";
import type { Capability } from "@kaenal/core";

export const IS_PUBLIC = "kaenal:isPublic";
export const REQUIRED_CAPABILITY = "kaenal:capability";

/**
 * Marks a route as reachable without a tenant or a session: health checks,
 * auth start, invite accept (01 §3.3). These routes get no tenant-scoped
 * transaction, so they cannot touch tenant tables at all.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);

/**
 * Declares the capability a route requires (03 §3). Absent = authenticated
 * tenant member, no specific capability.
 */
export const RequireCapability = (capability: Capability): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_CAPABILITY, capability);
