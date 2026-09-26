"use client";

import { useEffect, useState } from "react";

type TextField = HTMLInputElement | HTMLTextAreaElement;

function isInsertable(el: EventTarget | null): el is TextField {
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) {
    return ["text", "search", ""].includes(el.type) && !el.readOnly && !el.disabled;
  }
  return false;
}

/**
 * "Insert into field" target: the last text field the user focused on the page
 * (outside the drawer), while it is still mounted. Null => the W6-H "no field"
 * state. `insert` writes through the native setter and fires `input`, so
 * React-controlled fields pick the value up.
 */
export function useAiFieldTarget(): { hasField: boolean; insert: (text: string) => boolean } {
  const [field, setField] = useState<TextField | null>(null);

  // Effect justified: `focusin` is a document-level browser event; there is no
  // React handler on other screens' fields to hook into.
  useEffect(() => {
    const onFocusIn = (e: FocusEvent): void => {
      if (e.target instanceof Element && e.target.closest("[data-ai-drawer]") !== null) return;
      if (isInsertable(e.target)) setField(e.target);
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, []);

  const live = field !== null && field.isConnected ? field : null;

  const insert = (text: string): boolean => {
    if (live === null) return false;
    const proto = live instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor?.set === undefined) return false;
    const start = live.selectionStart ?? live.value.length;
    const end = live.selectionEnd ?? live.value.length;
    descriptor.set.call(live, live.value.slice(0, start) + text + live.value.slice(end));
    live.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  };

  return { hasField: live !== null, insert };
}
