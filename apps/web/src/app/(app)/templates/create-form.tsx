"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createTemplateAction, type ActionState } from "./actions";

const STARTER_SCHEMA = JSON.stringify(
  {
    sections: [
      {
        id: "safety",
        title: "Safety checks",
        weight: 1,
        items: [
          { id: "guard", type: "pass_fail", label: "Machine guard fitted", required: true, weight: 2 },
          { id: "ppe", type: "yes_no", label: "PPE worn", required: true, weight: 1, naAllowed: true },
          { id: "notes", type: "textarea", label: "Notes", required: false },
        ],
      },
    ],
  },
  null,
  2,
);

const initial: ActionState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn primary" type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create draft"}
    </button>
  );
}

export function CreateTemplateForm() {
  const [state, action] = useFormState(createTemplateAction, initial);

  return (
    <form action={action}>
      {state.error !== undefined && <div className="error">{state.error}</div>}
      {state.created !== undefined && (
        <div className="badge ok" style={{ marginBottom: 12 }}>
          Created “{state.created}” as a draft
        </div>
      )}
      <div className="field">
        <label htmlFor="name">Template name</label>
        <input id="name" name="name" placeholder="Weekly line safety walk" />
      </div>
      <div className="field">
        <label htmlFor="schema">Form schema (JSON)</label>
        <textarea id="schema" name="schema" rows={12} defaultValue={STARTER_SCHEMA} className="mono" />
      </div>
      <Submit />
    </form>
  );
}
