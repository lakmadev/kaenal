"use client";

import { Fragment, useState } from "react";
import { SettingsPage, SettingsCard, SettingsRow, Toggle } from "../settings-bits";

/** Notifications (settings.jsx `Notifications`): quiet hours, a per-event channel
 *  matrix, and digest. Preferences are local until a notification-prefs endpoint
 *  exists — the design is likewise client-side state. */

const CHANNELS = ["Email", "Push", "SMS", "Slack"] as const;

const EVENTS: { cat: string; items: { l: string; def: number[] }[] }[] = [
  {
    cat: "NCRs & 8D",
    items: [
      { l: "NCR assigned to me", def: [1, 1, 0, 1] },
      { l: "Critical-severity NCR opened in my area", def: [1, 1, 1, 1] },
      { l: "8D phase ready for my review", def: [1, 1, 0, 1] },
      { l: "NCR overdue", def: [1, 1, 1, 0] },
    ],
  },
  {
    cat: "Inspections",
    items: [
      { l: "Inspection assigned to me", def: [1, 1, 0, 0] },
      { l: "SPC out-of-control signal", def: [1, 1, 1, 1] },
      { l: "Inspection failed criteria", def: [1, 1, 0, 1] },
    ],
  },
  {
    cat: "Documents",
    items: [
      { l: "Approval requested", def: [1, 1, 0, 1] },
      { l: "Document expiring in 30 days", def: [1, 0, 0, 0] },
      { l: "Comment on doc I follow", def: [1, 1, 0, 0] },
    ],
  },
  {
    cat: "Audits & training",
    items: [
      { l: "Upcoming audit", def: [1, 0, 0, 0] },
      { l: "Training certification expiring", def: [1, 0, 0, 0] },
    ],
  },
];

export function NotificationsSection(): React.ReactElement {
  const [quiet, setQuiet] = useState(true);
  const [digest, setDigest] = useState(true);

  return (
    <SettingsPage title="Notifications" subtitle="Pick how and when Kaenal pings you. Critical safety alerts always go through.">
      <SettingsCard title="Quiet hours" desc="Non-critical notifications are batched during these times">
        <SettingsRow label="Enable quiet hours">
          <Toggle on={quiet} onChange={setQuiet} />
        </SettingsRow>
        <SettingsRow label="Schedule">
          <div className="flex items-center gap-2 text-[13px]">
            <input className="k-input" type="time" defaultValue="20:00" style={{ width: 110 }} />
            <span className="text-muted">to</span>
            <input className="k-input" type="time" defaultValue="07:00" style={{ width: 110 }} />
            <span className="ml-2 text-muted">weekdays</span>
          </div>
        </SettingsRow>
        <SettingsRow label="Override for critical">
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" defaultChecked style={{ accentColor: "var(--accent)" }} />
            Always notify for critical-severity NCRs and SPC out-of-control
          </label>
        </SettingsRow>
      </SettingsCard>

      <SettingsCard title="Event preferences" desc="Choose which channels deliver each event">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="k-overline px-1 py-2.5 text-left">Event</th>
                {CHANNELS.map((c) => (
                  <th key={c} className="k-overline px-1 py-2.5 text-center" style={{ width: 70 }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EVENTS.map((grp) => (
                <Fragment key={grp.cat}>
                  <tr>
                    <td colSpan={5} className="px-1 pb-1.5 pt-3.5 text-[12px] font-semibold text-muted">
                      {grp.cat}
                    </td>
                  </tr>
                  {grp.items.map((e) => (
                    <tr key={e.l} className="border-b border-border">
                      <td className="px-1 py-2.5 text-[13px]">{e.l}</td>
                      {CHANNELS.map((c, ci) => (
                        <td key={c} className="px-1 py-2.5 text-center">
                          <input type="checkbox" defaultChecked={e.def[ci] === 1} style={{ accentColor: "var(--accent)", transform: "scale(1.1)" }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsCard>

      <SettingsCard title="Digest" desc="A daily summary, instead of per-event notifications, for non-critical events">
        <SettingsRow label="Daily digest">
          <Toggle on={digest} onChange={setDigest} />
        </SettingsRow>
        <SettingsRow label="Delivery time">
          <input className="k-input" type="time" defaultValue="08:00" style={{ width: 110 }} />
        </SettingsRow>
      </SettingsCard>
    </SettingsPage>
  );
}
