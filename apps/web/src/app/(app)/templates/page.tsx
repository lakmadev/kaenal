import type { Page, TemplateDto } from "@kaenal/types";
import { api, ok } from "@/lib/api";
import { StatusBadge, formatDateTime } from "@/lib/ui";
import { CreateTemplateForm } from "./create-form";
import { publishTemplateAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const page = ok<Page<TemplateDto>>(await api().listTemplates({ query: { limit: 100 } }));
  const items = page.items;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Templates</h1>
          <p>Inspection templates. A published template’s schema is immutable.</p>
        </div>
      </div>

      <div className="card">
        {items.length === 0 ? (
          <div className="empty">No templates yet. Create your first one below.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Version</th>
                <th>Status</th>
                <th>Sections</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td>
                    <b>{t.name}</b>
                  </td>
                  <td className="mono">v{t.version}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td>{t.schema.sections.length}</td>
                  <td className="muted">{formatDateTime(t.createdAt)}</td>
                  <td style={{ textAlign: "right" }}>
                    {t.status === "draft" && (
                      <form action={publishTemplateAction.bind(null, t.id, t.lockVersion)}>
                        <button className="btn" type="submit">
                          Publish
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card card-pad">
        <h3 style={{ marginTop: 0 }}>New template</h3>
        <CreateTemplateForm />
      </div>
    </>
  );
}
