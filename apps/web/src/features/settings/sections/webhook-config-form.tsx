"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { decodeWebhookEvents, webhookConfigSchema, type IntegrationDto } from "@kaenal/types";
import { ApiRequestError } from "@kaenal/api-client";
import { useConfigureWebhook, useWebhookPolicy } from "@/hooks/use-integrations";
import { Field, Input, useToast } from "@/components/ui";

/**
 * Webhook endpoint configuration (settings.jsx `ApiWebhooks` endpoint cards →
 * URL + subscribed events + signing secret), wired to
 * `PUT /v1/integrations/:id/webhook`. Validation is the SHARED Zod schema
 * (`webhookConfigSchema`, packages/types) under the deployment's policy, so the
 * inline errors are exactly what the server enforces (SSRF rules included). The
 * signing secret is server-generated and write-only: it is shown once after
 * generate/rotate and never fetched again — afterwards the form only knows
 * "set".
 */

/** Event-domain shortcuts (audit entity kinds the outbox emits); custom patterns can be added. */
const PRESET_EVENTS = ["*", "ncr.*", "capa.*", "inspection.*", "audit.*", "supplier.*", "document.*", "fmea.*"] as const;

const chipStyle = (on: boolean): React.CSSProperties =>
  on
    ? { background: "var(--accent, #111)", color: "var(--accent-fg, #fff)", cursor: "pointer", border: 0 }
    : { background: "var(--bg-subtle)", color: "var(--text-muted)", cursor: "pointer", border: 0 };

export function WebhookConfigForm({ integration }: { integration: IntegrationDto }): React.ReactElement {
  const toast = useToast();
  const policy = useWebhookPolicy();
  const configure = useConfigureWebhook();

  const [url, setUrl] = useState(integration.config["url"] ?? "");
  const [events, setEvents] = useState<string[]>(
    integration.config["events"] !== undefined ? decodeWebhookEvents(integration.config["events"]) : ["*"],
  );
  const [custom, setCustom] = useState("");
  const [touched, setTouched] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const allowPrivate = policy.data?.allowPrivateTargets ?? false;
  const parsed = webhookConfigSchema({ allowPrivateTargets: allowPrivate }).safeParse({ url, events });
  const issues = parsed.success ? [] : parsed.error.issues;
  const urlError = touched ? issues.find((i) => i.path[0] === "url")?.message : undefined;
  const eventsError = touched ? issues.find((i) => i.path[0] === "events")?.message : undefined;
  const hasSecret = integration.hasCredentials;

  const toggle = (ev: string): void =>
    setEvents((cur) => (cur.includes(ev) ? cur.filter((e) => e !== ev) : [...cur, ev]));

  const addCustom = (): void => {
    const v = custom.trim();
    if (v === "") return;
    if (!events.includes(v)) setEvents((cur) => [...cur, v]);
    setCustom("");
  };

  const save = (rotateSecret: boolean): void => {
    setTouched(true);
    if (!parsed.success) return;
    configure.mutate(
      { id: integration.id, body: { url: parsed.data.url, events: parsed.data.events, rotateSecret, version: integration.lockVersion } },
      {
        onSuccess: (res) => {
          if (res.signingSecret !== null) {
            setRevealed(res.signingSecret);
            setCopied(false);
            toast.success(rotateSecret ? "Signing secret rotated" : "Webhook saved — copy your signing secret now");
          } else {
            toast.success("Webhook saved");
          }
        },
        onError: (e) => {
          if (e instanceof ApiRequestError && e.status === 403) toast.error("Requires an administrator");
          else if (e instanceof ApiRequestError && e.status === 409) toast.error("This webhook changed — reopen it and try again");
          else toast.error(e instanceof Error ? e.message : "Couldn't save webhook");
        },
      },
    );
  };

  const copy = (): void => {
    if (revealed === null) return;
    void navigator.clipboard.writeText(revealed).then(() => setCopied(true));
  };

  const customEvents = events.filter((e) => !(PRESET_EVENTS as readonly string[]).includes(e));

  return (
    <div className="mb-3 border-b border-border pb-3">
      <div className="k-overline mb-1.5">Endpoint</div>
      <div className="flex flex-col gap-3">
        <Field label="Destination URL" required error={urlError} hint={allowPrivate ? "Dev mode: http and local addresses are allowed." : "Must be a public https URL."}>
          {(p) => (
            <Input
              {...p}
              className="mono"
              placeholder="https://hooks.example.com/kaenal"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => setTouched(true)}
              spellCheck={false}
              autoComplete="off"
            />
          )}
        </Field>

        <div className="flex flex-col gap-1.5">
          <div className="text-[13px] font-medium text-text">Events</div>
          <div className="flex flex-wrap gap-1.5">
            {[...PRESET_EVENTS, ...customEvents].map((ev) => {
              const on = events.includes(ev);
              return (
                <button key={ev} type="button" className="k-chip mono" style={chipStyle(on)} aria-pressed={on} onClick={() => toggle(ev)}>
                  {on && <Check size={10} />}
                  {ev === "*" ? "All events" : ev}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              className="mono"
              placeholder="custom, e.g. ncr.created"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
              aria-label="Add a custom event pattern"
              spellCheck={false}
            />
            <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={addCustom} disabled={custom.trim() === ""}>
              <Plus size={12} /> Add
            </button>
          </div>
          {eventsError !== undefined && <p className="text-[12px] text-danger">{eventsError}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="text-[13px] font-medium text-text">Signing secret</div>
          {revealed !== null ? (
            <div className="flex flex-col gap-1.5 rounded-md border border-border p-2.5" style={{ background: "var(--bg-subtle)" }}>
              <div className="flex items-center gap-2">
                <code className="mono min-w-0 flex-1 truncate text-[12px]" data-testid="webhook-secret">
                  {revealed}
                </code>
                <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={copy}>
                  {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
                </button>
                <button type="button" className="k-btn-icon k-btn-plain" title="Hide" onClick={() => setRevealed(null)}>
                  <X size={14} />
                </button>
              </div>
              <p className="text-[11px] text-muted">Shown once. Kaenal stores it encrypted and can&apos;t show it again — rotate to get a new one.</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <KeyRound size={13} />
              {hasSecret ? "Secret is set (write-only)" : "Generated when you save"}
              {hasSecret && (
                <button
                  type="button"
                  className="k-btn k-btn-ghost k-btn-sm ml-auto"
                  disabled={configure.isPending}
                  title="Generate a new secret — the current one stops verifying immediately"
                  onClick={() => save(true)}
                >
                  <RefreshCw size={12} /> Rotate secret
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button type="button" className="k-btn k-btn-sm k-btn-primary" onClick={() => save(false)} disabled={configure.isPending || (touched && !parsed.success)}>
            {configure.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save endpoint
          </button>
        </div>
      </div>
    </div>
  );
}
