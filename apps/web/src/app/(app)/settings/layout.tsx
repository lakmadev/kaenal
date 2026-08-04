import { SettingsNavRail } from "@/features/settings/settings-nav-rail";

/**
 * Settings layout — the two-pane frame. The section rail stays mounted here across
 * navigation between `/settings/<section>` routes; only `children` (the section
 * content) swaps, so the nav no longer flickers or re-fetches.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex" style={{ height: "calc(100vh - 56px)" }}>
      <SettingsNavRail />
      <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
