import Link from "next/link";
import type { InspectionDto, TemplateDto } from "@kaenal/types";
import { api, ok } from "@/lib/api";
import { StatusBadge, formatDateTime } from "@/lib/ui";
import { answerText } from "@/lib/form";
import { startInspectionAction } from "../actions";
import { RunForm } from "./run-form";

export const dynamic = "force-dynamic";

export default async function InspectionDetailPage({ params }: { params: { id: string } }) {
  const client = api();
  const inspection = ok<InspectionDto>(await client.getInspection({ params: { id: params.id } }));
  const template = ok<TemplateDto>(
    await client.getTemplate({ params: { id: inspection.templateId } }),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <span className="mono">{inspection.code}</span> · {inspection.title}
          </h1>
          <p>
            Template <b>{template.name}</b> (v{inspection.templateVersion})
          </p>
        </div>
        <Link className="btn" href="/inspections">
          ← Back
        </Link>
      </div>

      <div className="card card-pad">
        <dl className="kv">
          <dt>Status</dt>
          <dd>
            <StatusBadge status={inspection.status} />
          </dd>
          <dt>Score</dt>
          <dd>{inspection.score === null ? "—" : `${inspection.score}%`}</dd>
          <dt>Scheduled</dt>
          <dd>{formatDateTime(inspection.scheduledAt)}</dd>
          <dt>Started</dt>
          <dd>{formatDateTime(inspection.startedAt)}</dd>
          <dt>Completed</dt>
          <dd>{formatDateTime(inspection.completedAt)}</dd>
        </dl>
      </div>

      {inspection.status === "scheduled" && (
        <div className="card card-pad">
          <p className="muted" style={{ marginTop: 0 }}>
            This inspection is scheduled. Start it to begin recording responses.
          </p>
          <form action={startInspectionAction.bind(null, inspection.id, inspection.lockVersion)}>
            <button className="btn primary" type="submit">
              Start inspection
            </button>
          </form>
        </div>
      )}

      {inspection.status === "in_progress" && (
        <>
          <h2 style={{ marginBottom: 12 }}>Record responses</h2>
          <RunForm id={inspection.id} version={inspection.lockVersion} schema={template.schema} />
        </>
      )}

      {inspection.status === "completed" && (
        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>Submitted responses</h3>
          <ResponseList schema={template.schema} responses={inspection.responses} />
        </div>
      )}
    </>
  );
}

function ResponseList({
  schema,
  responses,
}: {
  schema: TemplateDto["schema"];
  responses: Record<string, unknown>;
}) {
  const rows = schema.sections
    .flatMap((s) => s.items)
    .filter((i) => i.type !== "header" && i.type !== "info")
    .map((i) => ({ label: i.label, value: responses[i.id] }));

  return (
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Answer</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={idx}>
            <td>{r.label}</td>
            <td className="mono">{answerText(r.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
