import type { Metadata } from "next";
import { SupplierList } from "@/features/suppliers/supplier-list";

export const metadata: Metadata = { title: "Suppliers" };

export default function SuppliersPage(): React.ReactElement {
  return <SupplierList />;
}
