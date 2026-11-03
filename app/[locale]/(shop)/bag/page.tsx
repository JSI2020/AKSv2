import { OpenBag } from "@/modules/cart/open-bag";
import { pageMetadata } from "@/modules/seo/metadata";

export const metadata = pageMetadata({
  title: "Bag",
  description: "Your AKS-Atelier bag.",
  path: "/bag",
  noindex: true,
});

export default function BagPage() {
  return <OpenBag />;
}