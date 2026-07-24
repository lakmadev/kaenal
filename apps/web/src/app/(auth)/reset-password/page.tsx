import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

/**
 * `/reset-password?token=…` — the target of the emailed reset link (04 §4). The
 * token is a search param; the form posts it with the new password.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}): Promise<React.ReactElement> {
  const { token } = await searchParams;
  return <ResetPasswordForm token={token ?? ""} />;
}
