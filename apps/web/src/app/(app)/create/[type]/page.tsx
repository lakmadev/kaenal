import { Suspense } from "react";
import { CreateWizard } from "@/features/create-wizard/create-wizard";

/**
 * The CreateWizard's real, refreshable URL (S1-1 AC5): `/create/inspection`,
 * `/create/ncr`, `/create/8d`, `/create/document`. An unknown or ungranted type
 * shows the wizard's own permission-denied state rather than a 404 — the caller
 * is still inside the shell and can navigate away.
 */
export default async function CreatePage({
  params,
}: {
  params: Promise<{ type: string }>;
}): Promise<React.ReactElement> {
  const { type } = await params;
  return (
    <Suspense fallback={<div className="fixed inset-0 z-[1000] bg-bg" />}>
      <CreateWizard typeParam={type} />
    </Suspense>
  );
}
