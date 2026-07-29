import type { Metadata } from "next";
import { PpapList } from "@/features/ppap/ppap-list";

export const metadata: Metadata = { title: "PPAP" };

export default function PpapPage(): React.ReactElement {
  return <PpapList />;
}
