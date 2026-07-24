import type { Metadata } from "next";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Accept invitation" };

/**
 * `/invite/[token]?workspace=…` — accept a workspace invitation (04 §4). The
 * token is the path segment; the workspace slug (needed as `X-Tenant-Id`, since
 * there is no subdomain locally) rides as a search param on the emailed link and
 * is editable in the form as a fallback.
 */
export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ workspace?: string }>;
}): Promise<React.ReactElement> {
  const { token } = await params;
  const { workspace } = await searchParams;
  return <InviteForm token={token} initialWorkspace={workspace ?? ""} />;
}
