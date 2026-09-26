import { describe, expect, it } from "vitest";
import {
  ConfigureWebhookBody,
  STRICT_WEBHOOK_POLICY,
  decodeWebhookEvents,
  isBlockedIp,
  validateWebhookUrl,
  webhookConfigSchema,
} from "../src/webhook-config.js";

/** Webhook destination validation — an SSRF boundary; rejections matter most. */

const DEV = { allowPrivateTargets: true };

describe("validateWebhookUrl — strict (production) policy", () => {
  it.each(["https://hooks.example.com/kaenal", "https://example.com:8443/a?b=1", "https://8.8.8.8/x"])("accepts %s", (u) => {
    expect(validateWebhookUrl(u, STRICT_WEBHOOK_POLICY)).toBeNull();
  });

  it.each([
    ["plain http", "http://hooks.example.com/x"],
    ["ftp scheme", "ftp://example.com/x"],
    ["file scheme", "file:///etc/passwd"],
    ["javascript scheme", "javascript:alert(1)"],
    ["gopher", "gopher://example.com"],
    ["not a url", "hooks.example.com"],
    ["loopback v4", "https://127.0.0.1/x"],
    ["loopback range", "https://127.8.9.10/x"],
    ["localhost", "https://localhost/x"],
    ["sub.localhost", "https://a.localhost/x"],
    ["10/8", "https://10.0.0.5/x"],
    ["172.16/12", "https://172.20.1.1/x"],
    ["192.168/16", "https://192.168.1.1/x"],
    ["cloud metadata", "https://169.254.169.254/latest/meta-data"],
    ["CGNAT", "https://100.64.0.1/x"],
    ["0.0.0.0", "https://0.0.0.0/x"],
    ["decimal-encoded loopback", "https://2130706433/x"],
    ["hex-encoded loopback", "https://0x7f000001/x"],
    ["octal-encoded loopback", "https://0177.0.0.1/x"],
    ["short-form loopback", "https://127.1/x"],
    ["ipv6 loopback", "https://[::1]/x"],
    ["ipv6 unspecified", "https://[::]/x"],
    ["ipv4-mapped loopback", "https://[::ffff:127.0.0.1]/x"],
    ["ipv4-mapped metadata", "https://[::ffff:169.254.169.254]/x"],
    ["ipv6 link-local", "https://[fe80::1]/x"],
    ["ipv6 unique-local", "https://[fd00::1]/x"],
    ["NAT64 to loopback", "https://[64:ff9b::7f00:1]/x"],
    ["6to4 to private", "https://[2002:0a00:0001::1]/x"],
    ["metadata hostname", "https://metadata.google.internal/x"],
    [".internal", "https://svc.internal/x"],
    [".local", "https://printer.local/x"],
    ["single-label host", "https://intranet/x"],
    ["embedded credentials", "https://user:pw@hooks.example.com/x"],
  ])("rejects %s", (_n, u) => {
    expect(validateWebhookUrl(u, STRICT_WEBHOOK_POLICY)).not.toBeNull();
  });
});

describe("validateWebhookUrl — dev flag", () => {
  it("allows http + loopback only when the flag is on", () => {
    expect(validateWebhookUrl("http://127.0.0.1:4010/hook", DEV)).toBeNull();
    expect(validateWebhookUrl("http://localhost:4010/hook", DEV)).toBeNull();
  });
  it("still refuses non-http(s) schemes and embedded credentials", () => {
    expect(validateWebhookUrl("file:///etc/passwd", DEV)).not.toBeNull();
    expect(validateWebhookUrl("gopher://127.0.0.1", DEV)).not.toBeNull();
    expect(validateWebhookUrl("http://a:b@127.0.0.1/", DEV)).not.toBeNull();
  });
});

describe("isBlockedIp", () => {
  it("passes public addresses and fails closed on garbage", () => {
    expect(isBlockedIp("8.8.8.8")).toBe(false);
    expect(isBlockedIp("2606:4700:4700::1111")).toBe(false);
    expect(isBlockedIp("not-an-ip")).toBe(true);
    expect(isBlockedIp("1.2.3")).toBe(true);
  });
});

describe("webhookConfigSchema + events", () => {
  const schema = webhookConfigSchema(STRICT_WEBHOOK_POLICY);
  it("accepts *, exact and domain.* events", () => {
    expect(schema.safeParse({ url: "https://hooks.example.com/a", events: ["*", "ncr.created", "audit.*"] }).success).toBe(true);
  });
  it.each([[[]], [["NCR.created"]], [["ncr..created"]], [["ncr.*.x"]], [["ncr created"]], [[".*"]]])("rejects events %j", (events) => {
    expect(schema.safeParse({ url: "https://hooks.example.com/a", events }).success).toBe(false);
  });
  it("reports the URL violation on the url path", () => {
    const r = schema.safeParse({ url: "http://127.0.0.1/", events: ["*"] });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["url"]);
  });
  it("body defaults rotateSecret to false", () => {
    expect(ConfigureWebhookBody.parse({ url: "https://a.example.com", events: ["*"], version: 0 }).rotateSecret).toBe(false);
  });
  it("decodes an empty stored value as everything", () => {
    expect(decodeWebhookEvents(undefined)).toEqual(["*"]);
    expect(decodeWebhookEvents("ncr.*, audit.created")).toEqual(["ncr.*", "audit.created"]);
  });
});
