import { SettingsNavRail } from "@/features/settings/settings-nav-rail";

/**
 * Settings layout — the two-pane frame. The section rail stays mounted here across
 * navigation between `/settings/<section>` routes; only `children` (the section
 * content) swaps, so the nav no longer flickers or re-fetches.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex flex-col md:h-[calc(100vh-56px)] md:flex-row">
      <SettingsNavRail />
      <div className="min-w-0 flex-1 md:overflow-y-auto">{children}</div>
    </div>
  );
}
