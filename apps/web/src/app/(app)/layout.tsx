import { AppShell } from "@/components/shell/app-shell";

/**
 * The `(app)` route group — every authenticated screen renders inside the shell.
 * The shell itself enforces the session guard (redirects to sign-in on 401), so
 * this layout is a thin wrapper.
 */
export default function AppLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return <AppShell>{children}</AppShell>;
}
