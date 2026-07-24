"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { ThemeProvider } from "@/lib/theme";
import { ToastProvider } from "@/components/ui/toast";

/**
 * Client provider tree, mounted once in the root layout. Order matters only in
 * that everything interactive lives under the query + theme + toast context.
 * `getQueryClient()` returns the browser singleton here (never re-created on
 * re-render — held in `useState`'s initializer).
 */
export function Providers({ children }: { children: React.ReactNode }): React.ReactElement {
  const [queryClient] = useState(getQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
