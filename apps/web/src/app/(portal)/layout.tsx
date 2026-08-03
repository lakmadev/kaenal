import { PortalShell } from "@/features/portal/portal-shell";

/**
 * The `(portal)` route group — the external supplier surface. It renders inside
 * the teal PortalShell (top-nav, no internal sidebar), which owns the portal
 * session guard. Separate from `(app)` so no internal chrome ever leaks here.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return <PortalShell>{children}</PortalShell>;
}
