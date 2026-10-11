import { Link } from "@/i18n/routing";
import { auth } from "@/auth";
import { AccountFrame } from "@/modules/account/account-frame";
import { listCustomerOrders } from "@/modules/orders/customer-queries";

export default async function AccountOrdersPage() {
  const session = await auth();
  const orders =
    session?.user?.id && session.user.role === "CUSTOMER"
      ? await listCustomerOrders()
      : [];

  return (
    <AccountFrame section="orders" title="Your orders">
      {!session?.user?.id || session.user.role !== "CUSTOMER" ? (
        <div className="mt-4">
          <p className="text-[15px] leading-relaxed text-ink/75">
            Sign in to see orders linked to your account. Checked out as a
            guest? Track that order with your email instead.
          </p>
          <Link href="/account/login" className="btn-primary mt-5 inline-block">
            Sign in
          </Link>
        </div>
      ) : orders.length === 0 ? (
        <p className="mt-4 text-[15px] leading-relaxed text-ink/75">
          No orders yet. When you place one, it&apos;ll live here — every piece
          we&apos;ve made for you.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-greige-deep border-y border-greige-deep">
          {orders.map((order) => (
            <li key={order.orderNumber}>
              <Link
                href={`/account/orders/${order.orderNumber}`}
                className="flex items-center justify-between gap-3 py-4"
              >
                <div>
                  <p className="font-data text-[14px] text-ink">
                    {order.orderNumber}
                  </p>
                  <p className="mt-1 text-[13px] capitalize text-ink/60">
                    {order.productionStatus.replaceAll("_", " ").toLowerCase()}
                  </p>
                </div>
                {order.placedAt ? (
                  <time
                    dateTime={order.placedAt.toISOString()}
                    className="text-[13px] text-ink/55"
                  >
                    {new Intl.DateTimeFormat("en-PK", {
                      dateStyle: "medium",
                    }).format(order.placedAt)}
                  </time>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AccountFrame>
  );
}
