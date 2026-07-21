import Link from "next/link";
import type { InspectionDto, Page } from "@kaenal/types";
import { api, ok } from "@/lib/api";
import { StatusBadge, formatDateTime } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function InspectionsPage() {
  const page = ok<Page<InspectionDto>>(await api().listInspections({ query: { limit: 50 } }));
  const items = page.items;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inspections</h1>
          <p>Scheduled, in-progress and completed inspections in this workspace.</p>
        </div>
        <Link className="btn primary" href="/inspections/new">
          + New inspection
        </Link>
      </div>

      <div className="card">
        {items.length === 0 ? (
          <div className="empty">
            No inspections yet. Create one from a published template to get started.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Status</th>
                <th>Score</th>
                <th>Scheduled</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="mono">
                    <Link href={`/inspections/${i.id}`} style={{ color: "var(--primary)", fontWeight: 600 }}>
                      {i.code}
                    </Link>
                  </td>
                  <td>{i.title}</td>
                  <td>
                    <StatusBadge status={i.status} />
                  </td>
                  <td>{i.score === null ? "—" : `${i.score}%`}</td>
                  <td className="muted">{formatDateTime(i.scheduledAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
