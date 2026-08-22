import { useEffect, useRef, useState } from "react";
import { TextInput } from "react-native";
import * as Y from "yjs";
import type { PresenceEntity } from "@kaenal/types";

import { usePresence } from "@/hooks/use-presence";
import { getCollabState, postCollabUpdate } from "@/services/collab";
import { useTheme } from "@/theme";
import { collabRoom, onCollabUpdate } from "./bus";
import { fromBase64, seedUpdate, stringDiff, toBase64, ytextString } from "./crdt";

/**
 * A collaboratively-edited native TextInput (Phase R6.2) — the mobile mirror of
 * the web `CollabText`. Backed by a local Yjs doc: a local edit becomes an
 * incremental update POSTed to the relay and fanned to co-editors over the SSE
 * bus; inbound updates merge deterministically. Seeds from the same deterministic
 * base as the web, and pulls `/state` on mount (R7 late-join), so a web user and
 * a mobile user on the SAME field converge. Joins R4 presence so it's in the
 * room audience and shows as "editing". Persistence is the caller's job via
 * `onChange` (the 8D step-save path).
 */
export function CollabText({
  type,
  id,
  field,
  value,
  onChange,
  editable = true,
  placeholder,
  minHeight = 96,
}: {
  type: PresenceEntity;
  id: string;
  field: string;
  value: string;
  onChange: (next: string) => void;
  editable?: boolean;
  placeholder?: string;
  minHeight?: number;
}): React.ReactElement {
  usePresence(type, id, editable);
  const { palette, radius } = useTheme();
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

    seedingRef.current = true;
    Y.applyUpdate(doc, seedUpdate(valueRef.current), "seed");
    seedingRef.current = false;
    setText(ytextString(ytext));

    const onDocUpdate = (update: Uint8Array, origin: unknown): void => {
      if (origin === "local") void postCollabUpdate(type, id, field, toBase64(update));
    };
    doc.on("update", onDocUpdate);

    const observer = (): void => {
      const next = ytextString(ytext);
      setText(next);
      if (!seedingRef.current) onChange(next);
    };
    ytext.observe(observer);

    const off = onCollabUpdate(room, (b64) => {
      try {
        Y.applyUpdate(doc, fromBase64(b64), "remote");
      } catch {
        /* malformed — ignore */
      }
    });

    // Late-join (R7): converge with edits made before we opened the field.
    let joined = true;
    void getCollabState(type, id, field).then((state) => {
      if (joined && state !== null) {
        try {
          Y.applyUpdate(doc, fromBase64(state), "remote");
        } catch {
          /* ignore */
        }
      }
    });

    return () => {
      joined = false;
      off();
      ytext.unobserve(observer);
      doc.off("update", onDocUpdate);
      doc.destroy();
      docRef.current = null;
      ytextRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

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

  return (
    <TextInput
      value={text}
      onChangeText={applyLocalEdit}
      editable={editable}
      multiline
      placeholder={placeholder}
      placeholderTextColor={palette.subtle}
      style={{
        minHeight,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: radius.md,
        padding: 12,
        fontSize: 13.5,
        lineHeight: 20,
        color: palette.text,
        textAlignVertical: "top",
        backgroundColor: palette.surface,
      }}
    />
  );
}
