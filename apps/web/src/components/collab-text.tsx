"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import type { PresenceEntity } from "@kaenal/types";
import { collabRoom, onCollabUpdate } from "@/lib/collab-bus";
import { postCollabUpdate } from "@/lib/collab";
import { fromBase64, seedUpdate, stringDiff, toBase64, ytextString } from "@/lib/collab-crdt";
import { usePresence } from "@/hooks/use-presence";

/**
 * A collaboratively-edited textarea (Phase R5).
 *
 * Backed by a local Yjs (CRDT) doc: a local edit becomes an incremental Yjs
 * update POSTed to the collab relay, which fans it to co-viewers over the SSE
 * bus; an inbound update is applied to the doc and merges deterministically —
 * concurrent edits never clobber. Every client seeds from the same deterministic
 * base (see `seedUpdate`) so they converge. Persistence is unchanged: `onChange`
 * keeps the parent's draft in sync, and the entity's normal audited Save writes
 * the merged text.
 *
 * Drop-in for a plain `<textarea>` — same `value` / `onChange` contract.
 */
export function CollabText({
  type,
  id,
  field,
  value,
  onChange,
  canEdit,
  rows = 3,
  placeholder,
  className,
}: {
  type: PresenceEntity;
  id: string;
  field: string;
  value: string;
  onChange: (next: string) => void;
  canEdit: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
}): React.ReactElement {
  // Join presence so this editor is in the collab room audience (and shows as
  // "editing" to co-viewers via the R4 presence bar).
  usePresence(type, id, canEdit);

  const room = collabRoom(type, id, field);
  const docRef = useRef<Y.Doc | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);
  const seedingRef = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const [text, setText] = useState(value);

  useEffect(() => {
    const doc = new Y.Doc();
    const ytext = doc.getText("t");
    docRef.current = doc;
    ytextRef.current = ytext;

    // Shared deterministic base — NOT an independent insert (which Yjs would
    // duplicate across peers). Applied under a distinct origin so it isn't
    // re-broadcast, and with onChange suppressed (the value already equals it).
    seedingRef.current = true;
    Y.applyUpdate(doc, seedUpdate(valueRef.current), "seed");
    seedingRef.current = false;
    setText(ytextString(ytext));

    // Local edits → broadcast the incremental update; applied remotes never re-post.
    const onDocUpdate = (update: Uint8Array, origin: unknown): void => {
      if (origin === "local") void postCollabUpdate(type, id, field, toBase64(update));
    };
    doc.on("update", onDocUpdate);

    // Any doc change (local or remote) → reflect into the textarea + parent draft.
    const observer = (): void => {
      const next = ytextString(ytext);
      setText(next);
      if (!seedingRef.current) onChange(next);
    };
    ytext.observe(observer);

    // Inbound updates for this room → merge into the local doc.
    const off = onCollabUpdate(room, (b64) => {
      try {
        Y.applyUpdate(doc, fromBase64(b64), "remote");
      } catch {
        /* malformed update — ignore */
      }
    });

    return () => {
      off();
      ytext.unobserve(observer);
      doc.off("update", onDocUpdate);
      doc.destroy();
      docRef.current = null;
      ytextRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  // If the persisted value loads after mount and the doc is still empty, seed it.
  useEffect(() => {
    const doc = docRef.current;
    const ytext = ytextRef.current;
    if (doc !== null && ytext !== null && ytext.length === 0 && value.length > 0) {
      seedingRef.current = true;
      Y.applyUpdate(doc, seedUpdate(value), "seed");
      seedingRef.current = false;
    }
  }, [value]);

  const applyLocalEdit = (nextValue: string): void => {
    const doc = docRef.current;
    const ytext = ytextRef.current;
    if (doc === null || ytext === null) return;
    const { index, remove, insert } = stringDiff(ytextString(ytext), nextValue);
    if (remove === 0 && insert === "") return;
    doc.transact(() => {
      if (remove > 0) ytext.delete(index, remove);
      if (insert.length > 0) ytext.insert(index, insert);
    }, "local");
  };

  if (!canEdit) {
    return (
      <div
        className="rounded-md border p-2.5 text-[12.5px]"
        style={{ borderColor: "var(--border)", minHeight: 40, whiteSpace: "pre-wrap" }}
      >
        {text !== "" ? text : <span className="text-subtle">Not recorded yet.</span>}
      </div>
    );
  }

  return (
    <textarea
      className={className}
      rows={rows}
      placeholder={placeholder}
      value={text}
      onChange={(e) => applyLocalEdit(e.target.value)}
      style={{ resize: "vertical" }}
    />
  );
}
