import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * The one class-name combiner (industry-standard clsx + tailwind-merge): resolves
 * conditional classes and de-duplicates conflicting Tailwind utilities so the
 * last wins (`cn("p-2", isBig && "p-4")` → `p-4`). Every component uses this.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
