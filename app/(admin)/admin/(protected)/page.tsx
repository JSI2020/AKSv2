import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminHomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="font-sans text-xs uppercase tracking-[0.12em] text-chalk">
        AKS · admin
      </p>
      <h1 className="mt-2 font-display text-4xl text-greige">Today</h1>
      <p className="mt-2 text-sm text-chalk">
        Signed in as {session.user.email} ({session.user.role}).
      </p>
      <ul className="mt-8 flex flex-col gap-2 text-sm text-greige">
        <li>
          <Link className="underline-offset-2 hover:underline" href="/admin/tokens">
            Design tokens
          </Link>
        </li>
        <li>
          <Link
            className="underline-offset-2 hover:underline"
            href="/admin/assets-test"
          >
            Asset upload test
          </Link>
        </li>
      </ul>
    </main>
  );
}
