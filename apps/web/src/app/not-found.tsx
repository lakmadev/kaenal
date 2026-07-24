import Link from "next/link";

/** Root 404 — for URLs outside the app shell. In-app "not found" states render
 *  inside the shell as a NOT_FOUND panel (04 §9), not this page. */
export default function NotFound(): React.ReactElement {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-4 text-center">
      <div className="mono text-[40px] font-bold text-text">404</div>
      <p className="text-[14px] text-muted">This page could not be found.</p>
      <Link href="/dashboard" className="k-btn k-btn-primary">
        Back to dashboard
      </Link>
    </div>
  );
}
