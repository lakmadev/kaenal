import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/** Text input on the `.k-input` token class. `aria-invalid` drives the error ring. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn("k-input", className)} {...props} />;
});
