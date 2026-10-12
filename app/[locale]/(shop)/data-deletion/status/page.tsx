import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { readDeletionReceipt } from "@/modules/legal/meta-deletion";
import type { DeletionOutcome } from "@/modules/legal/meta-deletion";

export const metadata: Metadata = {
  title: "Deletion status — AKS",
};

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ code?: string }>;
};

const MESSAGES: Record<DeletionOutcome, string> = {
  erased:
    "We have removed the account data for this request. The order copy described in the privacy policy is still kept.",
  none: "This request did not match an AKS account. No profile was held under that sign-in id.",
  kept: "This request matched a staff login. This callback does not remove staff logins.",
};

export default async function DataDeletionStatusPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { code } = await searchParams;
  const secret = process.env.AUTH_SECRET?.trim() ?? "";
  const receipt = code && secret ? readDeletionReceipt(code, secret) : null;

  let body =
    "This confirmation link is not valid. Use the code Meta showed you, or write to us from the delete-your-data page.";
  if (!code) {
    body =
      "Add the confirmation code from Meta to this address (?code=) to see the result of a deletion request.";
  } else if (!secret) {
    body = "Status checks are not available until the shop secret is set.";
  } else if (receipt) {
    body = MESSAGES[receipt.outcome];
  }

  return (
    <main className="mx-auto max-w-[720px] px-[2.5rem] pb-24 pt-28 max-[900px]:px-[1.4rem]">
      <p
        className="text-[12px] uppercase tracking-[0.14em]"
        style={{ color: "var(--stone)" }}
      >
        AKS
      </p>
      <h1 className="serif mt-3 text-[clamp(2rem,4vw,2.8rem)] font-light leading-none">
        Deletion status
      </h1>
      <p
        className="mt-8 text-[15px] leading-relaxed"
        style={{ color: "var(--espresso)" }}
      >
        {body}
      </p>
      <p className="mt-8 text-[15px]">
        <Link href={"/data-deletion" as "/"}>Back to delete your data</Link>
      </p>
    </main>
  );
}
