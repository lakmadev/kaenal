import { redirect } from "next/navigation";

/** The app has no marketing home; land straight in the workspace (04 §4). */
export default function IndexPage(): never {
  redirect("/dashboard");
}
