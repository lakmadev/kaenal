import type { Metadata } from "next";
import { Suspense } from "react";
import { TrainingPage } from "@/features/training/training-page";

export const metadata: Metadata = { title: "Training & competency" };

export default function Page(): React.ReactElement {
  return (
    <Suspense>
      <TrainingPage />
    </Suspense>
  );
}
