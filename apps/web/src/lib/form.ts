/**
 * FormData reads, typed. `FormData.get` returns `string | File | null`; the
 * form fields here are always text, so this narrows to a string and keeps the
 * `String(File)` foot-gun (which stringifies to "[object File]") out of the
 * action code.
 */
export function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Renders an inspection answer for display without ever hitting [object Object]. */
export function answerText(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "—";
}
