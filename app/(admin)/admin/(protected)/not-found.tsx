import Link from "next/link";

/** Missing admin pages, inside the signed-in shell. */
export default function AdminNotFound() {
  return (
    <div className="flex flex-col gap-4 py-8">
      <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-ink/55">
        AKS · Admin
      </p>
      <h1 className="font-display text-[2.4rem] font-light leading-none text-ink">
        This page isn’t in the admin
      </h1>
      <p className="max-w-md text-[13.5px] text-ink/55">
        Check the address, or open a section from here.
      </p>
      <nav className="flex flex-wrap gap-4 text-[13px]">
        <Link href="/admin" className="underline">
          Overview
        </Link>
        <Link href="/admin/orders" className="underline">
          Orders
        </Link>
        <Link href="/admin/designs" className="underline">
          Designs
        </Link>
        <Link href="/admin/settings" className="underline">
          Settings
        </Link>
      </nav>
    </div>
  );
}
