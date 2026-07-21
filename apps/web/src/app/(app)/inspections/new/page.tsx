import Link from "next/link";
import type { Page, TemplateDto } from "@kaenal/types";
import { api, ok } from "@/lib/api";
import { NewInspectionForm } from "./new-form";

export const dynamic = "force-dynamic";

export default async function NewInspectionPage() {
  const page = ok<Page<TemplateDto>>(
    await api().listTemplates({ query: { limit: 100, status: "published" } }),
  );
  const templates = page.items.map((t) => ({ id: t.id, name: t.name, version: t.version }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>New inspection</h1>
          <p>Schedule an inspection from a published template.</p>
        </div>
        <Link className="btn" href="/inspections">
          ← Back
        </Link>
      </div>
      <div className="card card-pad" style={{ maxWidth: 560 }}>
        <NewInspectionForm templates={templates} />
      </div>
    </>
  );
}
