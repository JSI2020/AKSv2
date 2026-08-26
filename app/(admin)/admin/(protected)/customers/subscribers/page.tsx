import { redirect } from "next/navigation";

import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { listNewsletterSubscribers } from "@/modules/customers/newsletter-queries";
import { NewsletterSubscribersView } from "@/modules/customers/newsletter-subscribers-view";

export default async function NewsletterSubscribersPage() {
  let data;
  try {
    data = await listNewsletterSubscribers();
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  return <NewsletterSubscribersView data={data} />;
}
