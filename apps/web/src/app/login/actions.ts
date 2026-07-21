"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signInToApi } from "@/lib/auth";
import { ApiCallError } from "@/lib/api";
import { SESSION_COOKIE, TENANT_COOKIE } from "@/lib/session";
import { field } from "@/lib/form";

const TWELVE_HOURS = 60 * 60 * 12;

export interface SignInState {
  readonly error?: string;
}

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const tenant = field(formData, "tenant").trim();
  const email = field(formData, "email").trim();
  const password = field(formData, "password");

  if (tenant === "" || email === "" || password === "") {
    return { error: "All fields are required" };
  }

  let token: string;
  try {
    token = await signInToApi(tenant, email, password);
  } catch (err) {
    return { error: err instanceof ApiCallError ? err.message : "Sign-in failed" };
  }

  const jar = cookies();
  const opts = { httpOnly: true, sameSite: "lax", path: "/", maxAge: TWELVE_HOURS } as const;
  jar.set(SESSION_COOKIE, token, opts);
  jar.set(TENANT_COOKIE, tenant, opts);

  redirect("/inspections");
}
