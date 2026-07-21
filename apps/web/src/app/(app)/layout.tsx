import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import type { MeDto } from "@kaenal/types";
import { api, ok } from "@/lib/api";
import { getSession } from "@/lib/session";
import { Nav } from "./nav";
import { signOutAction } from "./actions";

/**
 * The authenticated shell. It fetches `/v1/me` server-side on every load, so
 * the identity shown (and, later, the controls rendered) always reflect the
 * role the API would enforce right now — not a snapshot cached at sign-in.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  if (getSession() === null) redirect("/login");

  let me: MeDto;
  try {
    me = ok<MeDto>(await api().getMe());
  } catch {
    // A stale or revoked token: bounce to login rather than render a broken shell.
    redirect("/login");
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          Kae<span>nal</span>
        </div>
        <Nav />
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="who">
            <b>{me.tenantSlug}</b> workspace
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span className="who">
              <b>{me.userId.slice(0, 8)}</b> · {me.role}
            </span>
            <form action={signOutAction}>
              <button className="btn" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
