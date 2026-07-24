/**
 * The `(auth)` route group — sign-in, password reset, invite acceptance. No
 * shell, no session; a centred card on the app background.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-12">
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  );
}
