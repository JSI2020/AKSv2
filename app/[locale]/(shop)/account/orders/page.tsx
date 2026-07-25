import { Link } from "@/i18n/routing";
import { auth } from "@/auth";
import { listCustomerOrders } from "@/modules/orders/customer-queries";
import { ShopPageContainer } from "@/modules/shop/shell/page-container";

export default async function AccountOrdersPage() {
  const session = await auth();
  const orders = session?.user?.id ? await listCustomerOrders() : [];

  return (
    <ShopPageContainer>
      <div className="mx-auto max-w-[640px] py-8 md:py-12">
        <h1 className="font-display text-[26px] font-medium text-ink md:text-[28px]">
          Your orders
        </h1>

        {!session?.user?.id ? (
          <p className="mt-4 text-[15px] leading-relaxed text-ink/75">
            Sign in to see orders linked to your account. If you checked out as a
            guest, use order tracking with your email instead.
          </p>
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
      </div>
    </ShopPageContainer>
  );
}
