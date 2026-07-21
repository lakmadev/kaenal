"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { FormSchema } from "@kaenal/types";
import { completeInspectionAction, type ActionState } from "../actions";

const initial: ActionState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn primary" type="submit" disabled={pending}>
      {pending ? "Submitting…" : "Complete inspection"}
    </button>
  );
}

/**
 * Renders the template's form schema as live controls and submits the answers.
 * Deliberately does NOT compute a score — the server does, from these exact
 * responses against the pinned template version. The form is a data-entry
 * surface, not the source of truth.
 */
export function RunForm({
  id,
  version,
  schema,
}: {
  id: string;
  version: number;
  schema: FormSchema;
}) {
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [state, action] = useFormState(completeInspectionAction, initial);

  const set = (key: string, value: unknown) => setResponses((r) => ({ ...r, [key]: value }));

  return (
    <form action={action}>
      {state.error !== undefined && <div className="error">{state.error}</div>}
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="responses" value={JSON.stringify(responses)} />

      {schema.sections.map((section) => (
        <div key={section.id} className="card card-pad" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>{section.title}</h3>
          {section.items.map((item) => {
            if (item.type === "header" || item.type === "info") {
              return (
                <p key={item.id} className="muted" style={{ fontWeight: 600 }}>
                  {item.label}
                </p>
              );
            }
            const value = responses[item.id];
            return (
              <div className="field" key={item.id}>
                <label htmlFor={item.id}>
                  {item.label}
                  {item.required ? <span style={{ color: "var(--danger)" }}> *</span> : null}
                </label>
                {renderControl(item, value, (v) => set(item.id, v))}
              </div>
            );
          })}
        </div>
      ))}
      <Submit />
    </form>
  );
}

function renderControl(
  item: FormSchema["sections"][number]["items"][number],
  value: unknown,
  onChange: (v: unknown) => void,
) {
  const asString = typeof value === "string" ? value : "";
  switch (item.type) {
    case "pass_fail":
    case "yes_no":
    case "select": {
      const options =
        item.type === "pass_fail"
          ? [
              { value: "pass", label: "Pass" },
              { value: "fail", label: "Fail" },
            ]
          : item.type === "yes_no"
            ? [
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]
            : (item.options ?? []);
      return (
        <select id={item.id} value={asString} onChange={(e) => onChange(e.target.value)}>
          <option value="">— select —</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    case "textarea":
      return (
        <textarea id={item.id} rows={3} value={asString} onChange={(e) => onChange(e.target.value)} />
      );
    case "score":
    case "number":
      return (
        <input
          id={item.id}
          type="number"
          value={typeof value === "number" ? value : ""}
          min={item.min}
          max={item.max}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      );
    case "date":
    case "datetime":
      return (
        <input
          id={item.id}
          type={item.type === "date" ? "date" : "datetime-local"}
          value={asString}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return <input id={item.id} value={asString} onChange={(e) => onChange(e.target.value)} />;
  }
}
