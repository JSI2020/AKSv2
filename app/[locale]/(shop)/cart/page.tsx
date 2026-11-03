import { OpenBag } from "@/modules/cart/open-bag";
import { pageMetadata } from "@/modules/seo/metadata";

export const metadata = pageMetadata({
  title: "Cart",
  description: "Your AKS-Atelier cart.",
  path: "/cart",
  noindex: true,
});

export default function CartPage() {
  return <OpenBag />;
}
