"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, FileWarning, FileCheck, LogOut, Truck, ArrowLeft } from "lucide-react";
import { ApiRequestError } from "@kaenal/api-client";
import { usePortalIdentity } from "@/hooks/use-portal";
import { useSignOut } from "@/hooks/use-sign-out";
import { Skeleton } from "@/components/ui";
import { TEAL, TEAL_DARK, TEAL_SOFT } from "./portal-bits";

const NAV = [
  { href: "/portal", label: "Overview", icon: Home, exact: true },
  { href: "/portal/scars", label: "Corrective actions", icon: FileWarning, exact: false },
  { href: "/portal/ppap", label: "PPAP", icon: FileCheck, exact: false },
];

/**
 * The external supplier-portal shell (FEATURES §17, P11) — a distinct
 * teal-accented TOP-nav (no internal sidebar) so a supplier always knows they
 * are outside the internal app. It owns the portal session guard: a 401 bounces
 * to sign-in; a non-partner (e.g. an internal admin with no supplier scope, who
 * gets a 403 from `/v1/portal/me`) is shown a "not a supplier account" notice.
 */
export function PortalShell({ children }: { children: React.ReactNode }): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const signOut = useSignOut();
  const { data: identity, error, isLoading } = usePortalIdentity();

  const status = error instanceof ApiRequestError ? error.status : undefined;
  const unauthenticated = status === 401;
  const notPartner = status === 403 || status === 404;

  useEffect(() => {
    if (unauthenticated) router.replace("/sign-in");
  }, [unauthenticated, router]);

  if (unauthenticated) return <div className="h-dvh" style={{ background: "#f6fafa" }} />;

  if (notPartner) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center" style={{ background: "#f6fafa" }}>
        <div className="text-[17px] font-semibold">This area is for supplier accounts</div>
        <p className="max-w-md text-[13px] text-muted">
          Your account isn&apos;t scoped to a supplier, so the portal has nothing to show. Head back to the Kaenal app.
        </p>
        <Link href="/dashboard" className="text-[13px] font-semibold" style={{ color: TEAL_DARK }}>
          ← Back to Kaenal app
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col" style={{ background: "#f6fafa", color: "#0f172a" }}>
      {/* Dark strip */}
      <div className="flex items-center gap-3 px-6 py-1.5 text-[11px] text-white" style={{ background: "#0f172a" }}>
        <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
          <Truck size={13} /> KAENAL Supplier Portal
        </span>
        <span style={{ color: "rgba(255,255,255,0.4)" }}>·</span>
        <span style={{ color: "rgba(255,255,255,0.7)" }}>
          {identity ? `${identity.supplierName} · ${identity.supplierCode}` : "…"}
        </span>
        <div className="flex-1" />
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium text-white"
          style={{ border: "1px solid rgba(255,255,255,0.18)" }}
        >
          <ArrowLeft size={11} /> Back to Kaenal app
        </Link>
      </div>

      {/* Main bar */}
      <div className="flex items-center gap-6 border-b px-6 py-2.5" style={{ background: "#fff", borderColor: "#e2e8f0" }}>
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
            style={{ background: `linear-gradient(135deg, ${TEAL}, ${TEAL_DARK})` }}
          >
            <Truck size={18} />
          </div>
          <div>
            <div className="text-[14px] font-bold leading-tight">{identity?.supplierName ?? <Skeleton className="h-4 w-28" />}</div>
            <div className="text-[11px] text-muted">Supplier dashboard</div>
          </div>
        </div>

        <nav className="ml-2 flex gap-1">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px]"
                style={{
                  background: active ? TEAL_SOFT : "transparent",
                  color: active ? TEAL_DARK : "#0f172a",
                  fontWeight: active ? 600 : 500,
                }}
              >
                <Icon size={14} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />
        <button
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted hover:text-text"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>

      <main className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="mx-auto max-w-6xl space-y-4 p-6">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
