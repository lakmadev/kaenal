"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createInspectionAction, type ActionState } from "../actions";

interface TemplateOption {
  readonly id: string;
  readonly name: string;
  readonly version: number;
}

const initial: ActionState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn primary" type="submit" disabled={pending}>
      {pending ? "Scheduling…" : "Schedule inspection"}
    </button>
  );
}

export function NewInspectionForm({ templates }: { templates: TemplateOption[] }) {
  const [state, action] = useFormState(createInspectionAction, initial);

  if (templates.length === 0) {
    return (
      <div className="empty">
        No published templates. Publish a template first, then you can schedule inspections against it.
      </div>
    );
  }

  return (
    <form action={action}>
      {state.error !== undefined && <div className="error">{state.error}</div>}
      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" name="title" placeholder="Line 3 weekly safety walk" />
      </div>
      <div className="field">
        <label htmlFor="templateId">Template</label>
        <select id="templateId" name="templateId" defaultValue={templates[0]?.id}>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} (v{t.version})
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="plantId">Plant ID (optional)</label>
        <input id="plantId" name="plantId" placeholder="uuid — leave blank for none" />
      </div>
      <Submit />
    </form>
  );
}
