import type { Metadata } from "next";
import { EightDList } from "@/features/eightd/eightd-list";

export const metadata: Metadata = { title: "8D Problem Solving" };

export default function Page(): React.ReactElement {
  return <EightDList />;
}
