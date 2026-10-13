import { Link } from "@/i18n/routing";

/** Missing shop routes keep the storefront header and footer. */
export default function ShopNotFound() {
  return (
    <main className="mx-auto max-w-[720px] px-6 pb-24 pt-28">
      <p className="text-[11px] uppercase tracking-[0.18em] text-stone">AKS</p>
      <h1 className="serif mt-3 text-[2.4rem] font-light leading-none">
        This page isn’t here
      </h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-stone">
        The address may have changed. You can still browse the shop, sign in,
        or read how shipping and returns work.
      </p>
      <nav className="mt-6 flex flex-wrap gap-4 text-[14px]">
        <Link href="/">Home</Link>
        <Link href="/collections">Shop</Link>
        <Link href="/account/login">Sign in</Link>
        <Link href={"/pages/shipping-returns" as const}>
          Shipping & returns
        </Link>
      </nav>
    </main>
  );
}
