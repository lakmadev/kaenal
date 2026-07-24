import { useId } from "react";
import { cn } from "@/lib/cn";

export interface FieldProps {
  label: string;
  /** Validation message; when set, the control gets `aria-invalid` + describedby. */
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean;
  className?: string;
  /** Render-prop so the control is wired to the generated id + aria attributes. */
  children: (props: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby": string | undefined;
  }) => React.ReactNode;
}

/**
 * Accessible form field: label ↔ control association, error text wired via
 * `aria-describedby`, and `aria-invalid` on the control (04 §8). Forms compose
 * this with React Hook Form; the control is a render-prop so any input works.
 */
export function Field({ label, error, hint, required, className, children }: FieldProps): React.ReactElement {
  const id = useId();
  const describedBy = error !== undefined ? `${id}-error` : hint !== undefined ? `${id}-hint` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-text">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children({ id, "aria-invalid": error !== undefined, "aria-describedby": describedBy })}
      {error !== undefined ? (
        <p id={`${id}-error`} className="text-[12px] text-danger">
          {error}
        </p>
      ) : hint !== undefined ? (
        <p id={`${id}-hint`} className="text-[12px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
