/**
 * Live-mode toast rule (S1-3). The realtime bus is a pointer channel, so the
 * toast candidate is the caller's OWN notification (the server already
 * targets it to this user's stream): it names who caused it and which record
 * it is about. A toast is raised only when someone else acted and the record
 * has a real detail route; the user's own edits never toast.
 */
export interface LiveToastCandidate {
  readonly id: string;
  /** The person who caused it; null for system/job notifications. */
  readonly actorId: string | null;
  readonly entityKind: string | null;
  readonly entityId: string | null;
}

export function shouldToast(
  candidate: LiveToastCandidate,
  currentUserId: string,
  hasDetailRoute: (kind: string) => boolean,
): boolean {
  if (candidate.actorId === currentUserId) return false;
  if (candidate.entityKind === null || candidate.entityId === null) return false;
  return hasDetailRoute(candidate.entityKind);
}
