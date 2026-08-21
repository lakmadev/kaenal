// "Photo + AI" NCR triage (m-ncr create step 1/2 "AI pre-filled from your photo").
// Sends the first evidence photo to the governed AI gateway's vision feature
// (`ncr_photo_triage`) and parses its JSON draft into NCR field prefills. The
// gateway enforces entitlement/budget/region and logs the invocation; the model
// itself is whatever the API is configured with (local Ollama vision by default).

import type { NcrPriority } from "@kaenal/types";

import { apiClient } from "@/lib/api";
import { services } from "@/services";

export interface TriageDraft {
  title?: string;
  severity?: NcrPriority;
  category?: string;
  description?: string;
  /** The model's OWN estimate of how confident it is (0–100). Advisory — shown on
   *  the live-detect overlay as an AI estimate, never as a measured detector score. */
  confidence?: number;
}

/** Read a local file uri (native file:// or web blob/data) as raw base64. */
async function uriToBase64(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Could not read the image"));
    fr.readAsDataURL(blob);
  });
  return dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
}

const CATEGORIES = new Set(["Process", "Product", "Material", "Documentation", "Other"]);

/** Pull the first {...} JSON object out of a model response (tolerates fences). */
function parseDraft(value: string): TriageDraft {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end <= start) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(value.slice(start, end + 1));
  } catch {
    return {};
  }
  const o = raw as Record<string, unknown>;
  const out: TriageDraft = {};
  if (typeof o["title"] === "string" && o["title"].trim()) out.title = o["title"].trim().slice(0, 120);
  const sev = typeof o["severity"] === "string" ? o["severity"].toLowerCase() : "";
  if (sev === "minor" || sev === "major" || sev === "critical") out.severity = sev;
  if (typeof o["category"] === "string" && CATEGORIES.has(o["category"])) out.category = o["category"];
  if (typeof o["description"] === "string" && o["description"].trim()) out.description = o["description"].trim();
  const conf = typeof o["confidence"] === "number" ? o["confidence"] : Number(o["confidence"]);
  if (Number.isFinite(conf)) out.confidence = Math.max(0, Math.min(100, Math.round(conf)));
  return out;
}

/** Shared vision call: post base64 image(s) to the governed AI gateway's
 *  `ncr_photo_triage` feature and parse the JSON draft. Throws a friendly message. */
async function runVisionTriage(imagesBase64: string[], note: string): Promise<TriageDraft> {
  const res = await apiClient.requestAiDraft({
    body: {
      feature: "ncr_photo_triage",
      input:
        (note.trim().length > 0 ? note.trim() : "Triage the attached defect photo.") +
        ' Reply as JSON {"title","severity":"minor|major|critical","category","description","confidence":0-100}.',
      imagesBase64,
    },
  });
  if (res.status !== 200) {
    const status: number = res.status;
    const msg =
      status === 402 || status === 403
        ? "AI isn't enabled for this workspace."
        : status === 503
          ? "AI is busy — try again in a moment."
          : "Couldn't analyse the image.";
    throw new Error(msg);
  }
  return parseDraft(res.body.value);
}

/**
 * Analyse a live camera frame (raw base64) with the vision model — the engine
 * behind CapCamera's on-frame overlay. Same governed gateway as photo triage; the
 * frame is not staged as evidence (it is a throwaway preview grab).
 */
export async function analyzeFrame(base64: string, note = ""): Promise<TriageDraft> {
  return runVisionTriage([base64], note);
}

/**
 * Run vision triage on a staged evidence photo (by local file id). Returns the
 * parsed prefill, or throws with a friendly message the caller surfaces. Never
 * writes anything — the inspector reviews and edits the draft (advisory only).
 */
export async function triageFromPhoto(photoLocalId: string, note: string): Promise<TriageDraft> {
  const files = await services.syncStore.listFiles();
  const file = files.find((f) => f.id === photoLocalId);
  if (!file) throw new Error("That photo is no longer available.");

  return runVisionTriage([await uriToBase64(file.localUri)], note);
}
