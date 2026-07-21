"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, SESSION_COOKIE, TENANT_COOKIE } from "@/lib/session";
import { signOutFromApi } from "@/lib/auth";

export async function signOutAction(): Promise<void> {
  const session = getSession();
  if (session !== null) await signOutFromApi(session.tenant, session.token);
  const jar = cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(TENANT_COOKIE);
  redirect("/login");
}
