"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { InspectionDto } from "@kaenal/types";
import { api, ApiCallError, ok } from "@/lib/api";
import { field } from "@/lib/form";

export interface ActionState {
  readonly error?: string;
}

export async function createInspectionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const title = field(formData, "title").trim();
  const templateId = field(formData, "templateId").trim();
  const plantId = field(formData, "plantId").trim();

  if (title === "" || templateId === "") return { error: "Title and template are required" };

  let created: InspectionDto;
  try {
    created = ok<InspectionDto>(
      await api().createInspection({
        body: {
          title,
          templateId,
          ...(plantId !== "" ? { plantId } : {}),
        },
      }),
    );
  } catch (err) {
    return { error: err instanceof ApiCallError ? err.message : "Could not create the inspection" };
  }

  redirect(`/inspections/${created.id}`);
}

export async function startInspectionAction(id: string, version: number): Promise<void> {
  ok(await api().startInspection({ params: { id }, body: { version } }));
  revalidatePath(`/inspections/${id}`);
}

export async function completeInspectionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = field(formData, "id");
  const version = Number(field(formData, "version") || "0");
  const responsesRaw = field(formData, "responses") || "{}";

  let responses: Record<string, unknown>;
  try {
    responses = JSON.parse(responsesRaw) as Record<string, unknown>;
  } catch {
    return { error: "Responses were not valid JSON" };
  }

  try {
    ok(await api().completeInspection({ params: { id }, body: { responses, version } }));
  } catch (err) {
    return { error: err instanceof ApiCallError ? err.message : "Could not complete the inspection" };
  }

  revalidatePath(`/inspections/${id}`);
  return {};
}
