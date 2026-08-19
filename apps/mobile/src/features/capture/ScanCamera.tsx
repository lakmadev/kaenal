// Base module for the platform-split live scanner. tsc resolves this for types and
// Metro overrides it with `ScanCamera.native.tsx` (real camera) / `ScanCamera.web.tsx`
// (stub) at bundle time — same three-file pattern as the sync store. Never rendered
// directly; the native/web variants win.
export function ScanCamera(_: { onScan: (value: string) => void }): null {
  return null;
}
