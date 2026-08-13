import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { PLANNED_MODULES } from "@/config/planned-modules";

/**
 * Catch-all for sidebar modules that are on the plan but not built yet
 * (`config/planned-modules.ts`). Static routes take precedence, so this only
 * runs for unmatched paths: a planned slug renders the "coming soon" placeholder;
 * anything else is a real 404.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const mod = PLANNED_MODULES[slug[0] ?? ""];
  return { title: mod?.title ?? "Not found" };
}

export default async function PlannedModulePage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<React.ReactElement> {
  const { slug } = await params;
  const mod = PLANNED_MODULES[slug[0] ?? ""];
  if (mod === undefined) notFound();
  return (
    <ModulePlaceholder
      title={mod.title}
      icon={mod.icon}
      {...(mod.description !== undefined ? { description: mod.description } : {})}
    />
  );
}
