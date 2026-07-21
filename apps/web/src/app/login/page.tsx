"use client";

import { useFormState, useFormStatus } from "react-dom";
import { signInAction, type SignInState } from "./actions";

const initial: SignInState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button className="btn primary" type="submit" disabled={pending} style={{ width: "100%", justifyContent: "center" }}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginPage() {
  const [state, action] = useFormState(signInAction, initial);

  return (
    <div className="login-wrap">
      <div className="card card-pad login-card">
        <div className="brand">
          Kae<span>nal</span>
        </div>
        <p className="muted" style={{ marginTop: 0, marginBottom: 20 }}>
          Sign in to your workspace.
        </p>

        {state.error !== undefined && <div className="error">{state.error}</div>}

        <form action={action}>
          <div className="field">
            <label htmlFor="tenant">Workspace</label>
            <input id="tenant" name="tenant" placeholder="acme" defaultValue="acme" autoComplete="organization" />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" placeholder="you@acme.test" autoComplete="username" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" />
          </div>
          <SubmitButton />
        </form>
      </div>
    </div>
  );
}
