"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** Password input with a show/hide toggle — the pattern used across every auth
 *  screen (sign-in, reset, invite). Uncontrolled toggle, controlled value. */
export function PasswordField({
  value,
  onChange,
  placeholder = "••••••••",
  autoFocus,
  autoComplete = "new-password",
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  autoComplete?: string;
  "aria-label"?: string;
}): React.ReactElement {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        className="k-input"
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        aria-label={ariaLabel}
        style={{ height: 42, paddingRight: 42 }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute flex items-center justify-center text-muted"
        style={{ right: 6, top: 6, width: 30, height: 30 }}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}
