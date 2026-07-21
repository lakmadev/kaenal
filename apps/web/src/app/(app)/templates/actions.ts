"use server";

import { revalidatePath } from "next/cache";
import type { FormSchema } from "@kaenal/types";
import { api, ApiCallError, ok } from "@/lib/api";
import { field } from "@/lib/form";

export interface ActionState {
  readonly error?: string;
  readonly created?: string;
}

export async function createTemplateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const name = field(formData, "name").trim();
  const schemaRaw = field(formData, "schema");
  if (name === "") return { error: "A name is required" };

  let schema: FormSchema;
  try {
    // Server-side revalidation still happens in the API against the contract's
    // Zod schema — this cast only satisfies the client's static types.
    schema = JSON.parse(schemaRaw) as FormSchema;
  } catch {
    return { error: "The schema is not valid JSON" };
  }

  try {
    const created = ok<{ name: string }>(await api().createTemplate({ body: { name, schema } }));
    revalidatePath("/templates");
    return { created: created.name };
  } catch (err) {
    return { error: err instanceof ApiCallError ? err.message : "Could not create the template" };
  }
}

export async function publishTemplateAction(id: string, version: number): Promise<void> {
  ok(await api().publishTemplate({ params: { id }, body: { version } }));
  revalidatePath("/templates");
}
