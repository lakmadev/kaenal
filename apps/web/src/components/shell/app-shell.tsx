"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ApiRequestError, apiQueries } from "@kaenal/api-client";
import { useMe } from "@/hooks/use-me";
import { useRealtime } from "@/hooks/use-realtime";
import { roleSeesRoute } from "@/config/rbac";
import { getApiClient } from "@/lib/api";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { Skeleton } from "@/components/ui";

/**
 * The authenticated shell (04 §3). It owns the client-side session guard: a 401
 * from `GET /v1/me` means no valid session, so it bounces to sign-in. While the
 * identity loads it shows a shell-shaped skeleton, never a spinner (04 §6.1).
 * Once loaded, the sidebar uses `me.capabilities` to gate nav.
 */
export function AppShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: me, error, isLoading } = useMe();

  const unauthenticated = error instanceof ApiRequestError && error.status === 401;

  // Role route guard (RBAC): a role that deep-links a module its UI doesn't
  // surface is bounced to the dashboard. Belt-and-suspenders — the server still
  // 403s the underlying data — but it avoids rendering a shell around an empty
  // or forbidden page. `dashboard`/`settings` are always allowed, so no loop.
  const blockedByRole =
    me !== undefined && !roleSeesRoute(me.role, pathname);

  // An external partner has only portal:* capabilities and nothing internal to
  // render here — send them to their own surface (P11) rather than an empty shell.
  const portalOnly =
    me !== undefined &&
    me.capabilities.length > 0 &&
    me.capabilities.every((c) => c.startsWith("portal:"));

  useEffect(() => {
    if (unauthenticated) router.replace("/sign-in");
    else if (portalOnly) router.replace("/portal");
    else if (blockedByRole) router.replace("/dashboard");
  }, [unauthenticated, portalOnly, blockedByRole, router]);

  // Realtime signal stream (Phase R1): live-invalidate queries as changes land
  // elsewhere. Connect only for an authenticated internal session, so an
  // unauthenticated or portal-only page never opens a stream that would 401.
  useRealtime(me !== undefined && !unauthenticated && !portalOnly);

  // Warm the members directory once the session is known (internal users only).
  // Nearly every screen resolves an owner/inspector/author/assignee id → name
  // through `/v1/members` (MemberCell, AssigneePicker, ActivityFeed); prefetching
  // it here means those never render an id-fallback that flips to a name on the
  // first paint of a page or tab — the pervasive "first-visit flicker".
  useEffect(() => {
    if (me === undefined || portalOnly) return;
    void queryClient.prefetchQuery(apiQueries.members.list(getApiClient(), { query: { limit: 100 } }));
  }, [me, portalOnly, queryClient]);

  if (unauthenticated || portalOnly) return <FullBleed />;

  return (
    <div className="flex h-dvh overflow-hidden">
      <Suspense fallback={<div className="w-[260px] shrink-0 bg-sidebar-bg max-lg:hidden" />}>
        <Sidebar me={me} />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar me={me} />
        <main className="flex-1 overflow-y-auto">
          {isLoading ? <ShellSkeleton /> : children}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}

function FullBleed(): React.ReactElement {
  return <div className="h-dvh bg-bg" />;
}

function ShellSkeleton(): React.ReactElement {
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}
