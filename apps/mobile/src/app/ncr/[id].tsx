import { useLocalSearchParams } from "expo-router";

import { NcrDetailView } from "@/features/ncr/NcrDetailView";

// The phone NCR detail route — a thin wrapper over the shared NcrDetailView
// (the tablet two-pane renders the same view in its detail column).
export default function NcrDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <NcrDetailView id={id ?? ""} />;
}
