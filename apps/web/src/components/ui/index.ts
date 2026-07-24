/**
 * The design-system barrel — the ONE import path for UI primitives
 * (`import { Button, Card, StatusBadge } from "@/components/ui"`). Everything
 * here is styled against the design tokens (`src/styles`), so the whole product
 * restyles from one place. Feature screens compose these; they don't hard-code
 * colour or re-implement primitives.
 */
export { Button, type ButtonProps } from "./button";
export { Card, CardHeader, CardTitle, CardContent } from "./card";
export { Chip, type ChipProps } from "./chip";
export { StatusBadge, PriorityBadge, RiskBadge } from "./badge";
export { Input, type InputProps } from "./input";
export { Field, type FieldProps } from "./field";
export { Skeleton } from "./skeleton";
export { Spinner } from "./spinner";
export { EmptyState, type EmptyStateProps } from "./empty-state";
export { ToastProvider, useToast } from "./toast";
