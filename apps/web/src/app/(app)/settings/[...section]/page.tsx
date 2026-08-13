import type { Metadata } from "next";
import { SettingsContent } from "@/features/settings/settings-shell";
import { settingsItem, DEFAULT_SETTINGS_SECTION } from "@/features/settings/settings-nav";

/** Resolve the URL slug to a known section, defaulting to Profile. */
function resolveSection(slug: string[] | undefined): string {
  const first = slug?.[0];
  return first !== undefined && settingsItem(first) !== undefined ? first : DEFAULT_SETTINGS_SECTION;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string[] }>;
}): Promise<Metadata> {
  const { section } = await params;
  const item = settingsItem(resolveSection(section));
  return { title: item !== undefined ? `${item.label} · Settings` : "Settings" };
}

export default async function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string[] }>;
}): Promise<React.ReactElement> {
  const { section } = await params;
  return <SettingsContent section={resolveSection(section)} />;
}
