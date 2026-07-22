/** Request-derived provenance threaded into every audit event (07 §1). */
export interface AuditContext {
  readonly requestId: string | null;
  readonly ip: string | null;
  readonly userAgent: string | null;
}
