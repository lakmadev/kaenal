import type { Metadata } from "next";
import { ScheduleView } from "@/features/inspections/schedule-view";

export const metadata: Metadata = { title: "Inspection Schedule" };

export default function SchedulePage(): React.ReactElement {
  return <ScheduleView />;
}
