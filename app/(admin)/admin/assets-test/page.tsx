import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { AssetsTestClient } from "./assets-test-client";

export default async function AssetsTestPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");
  const role = (session.user as { role?: string }).role;
  if (!role || role === "CUSTOMER") redirect("/admin/login");

  return <AssetsTestClient />;
}
