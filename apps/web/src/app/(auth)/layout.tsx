/**
 * The `(auth)` route group — sign-in, password reset, invite acceptance. No app
 * shell and no session; each page renders the full-bleed two-column auth layout
 * (`AuthShell`) itself.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return <>{children}</>;
}
