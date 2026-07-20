import { SetMetadata } from "@nestjs/common";
import type { Capability } from "@kaenal/core";

export const IS_PUBLIC = "kaenal:isPublic";
export const IS_ANONYMOUS = "kaenal:isAnonymous";
export const REQUIRED_CAPABILITY = "kaenal:capability";

/**
 * Marks a route as reachable without a tenant or a session: health checks,
 * auth start, invite accept (01 §3.3). These routes get no tenant-scoped
 * transaction, so they cannot touch tenant tables at all.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);

/**
 * Runs the full lifecycle — tenant resolution and the tenant-scoped
 * transaction — but does NOT require a session.
 *
 * This is what sign-in, invite acceptance and password reset need: they are
 * unauthenticated by definition, yet every one of them reads or writes
 * tenant-owned rows and so must still be inside RLS. `@Public` would skip the
 * transaction entirely and leave them unscoped.
 */
export const AllowAnonymous = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_ANONYMOUS, true);

/**
 * Declares the capability a route requires (03 §3). Absent = authenticated
 * tenant member, no specific capability.
 */
export const RequireCapability = (capability: Capability): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_CAPABILITY, capability);
