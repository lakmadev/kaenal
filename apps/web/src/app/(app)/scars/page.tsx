import type { Metadata } from "next";
import { ScarList } from "@/features/scar/scar-list";

export const metadata: Metadata = { title: "SCAR & chargebacks" };

export default function ScarsPage(): React.ReactElement {
  return <ScarList />;
}
