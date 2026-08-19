import { useLocalSearchParams } from "expo-router";

import { ApprovalDetailView } from "@/features/oversight/ApprovalDetailView";

// Phone approval route — thin wrapper over the shared ApprovalDetailView (the
// tablet two-pane renders the same view in its detail column).
export default function ApprovalRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ApprovalDetailView id={id ?? ""} />;
}
