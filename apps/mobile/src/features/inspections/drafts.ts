import type { FormResponses } from "@kaenal/types";

import { services } from "@/services";

/**
 * Local, offline-durable inspection drafts (05 §M6 "autosave + resume").
 *
 * As the inspector answers, responses are written to the KV store (AsyncStorage
 * on native, localStorage on web) keyed by inspection id — NOT to the server.
 * A draft survives app kill and offline; it is cleared once the inspection is
 * completed (the `complete` mutation is what actually reaches the server, through
 * the offline queue). This is deliberately separate from the sync mirror: the
 * mirror holds server truth, the draft holds the inspector's in-progress edits.
 */

const PREFIX = "kaenal.inspection.draft.";

export interface InspectionDraft {
  inspectionId: string;
  responses: FormResponses;
  /** ISO time of the last local edit — drives the "Autosaved" affordance. */
  updatedAt: string;
}

function key(id: string): string {
  return `${PREFIX}${id}`;
}

export async function loadDraft(id: string): Promise<InspectionDraft | null> {
  const raw = await services.kv.getItem(key(id));
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as InspectionDraft;
  } catch {
    return null;
  }
}

export async function saveDraft(id: string, responses: FormResponses): Promise<InspectionDraft> {
  const draft: InspectionDraft = { inspectionId: id, responses, updatedAt: new Date().toISOString() };
  await services.kv.setItem(key(id), JSON.stringify(draft));
  return draft;
}

export async function clearDraft(id: string): Promise<void> {
  await services.kv.removeItem(key(id));
}
