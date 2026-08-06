import type { Metadata } from "next";
import { NotificationsCenter } from "@/features/notifications/notifications-center";

export const metadata: Metadata = { title: "Notifications" };

export default function Page(): React.ReactElement {
  return <NotificationsCenter />;
}
