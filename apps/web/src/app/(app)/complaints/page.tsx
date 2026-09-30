import type { Metadata } from "next";
import { Suspense } from "react";
import { ComplaintsRegisterPage } from "@/features/complaints/complaints-register-page";

export const metadata: Metadata = { title: "Customer complaints" };

export default function ComplaintsPage(): React.ReactElement {
  return (
    <Suspense>
      <ComplaintsRegisterPage />
    </Suspense>
  );
}
