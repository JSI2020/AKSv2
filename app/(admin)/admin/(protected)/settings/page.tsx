import Link from "next/link";
import { redirect } from "next/navigation";
import {
  FileText,
  Palette,
  Ruler,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";

import { Eyebrow } from "@/modules/ui";
import { auth } from "@/auth";
import {
  getPermissionsForUser,
  PermissionDeniedError,
  requirePermission,
  UnauthenticatedError,
} from "@/modules/auth";

type Card = {
  href: string;
  title: string;
  desc: string;
  icon: typeof Users;
};

type Section = { label: string; cards: Card[] };

function SettingsCard({ card }: { card: Card }) {
  const Icon = card.icon;
  return (
    <Link
      href={card.href}
      className="group flex flex-col gap-2 border border-indigo-lift bg-indigo-lift/20 p-4 transition-colors hover:border-chalk/40 hover:bg-indigo-lift/40"
    >
      <div className="flex items-center gap-2.5">
        <Icon className="size-4 shrink-0 text-zari" aria-hidden />
        <span className="font-sans text-[13.5px] text-greige">
          {card.title}
        </span>
      </div>
      <p className="text-[12px] leading-relaxed text-chalk">{card.desc}</p>
    </Link>
  );
}

export default async function AdminSettingsPage() {
  try {
    await requirePermission("settings.view");
  } catch (e) {
    if (e instanceof UnauthenticatedError) redirect("/admin/login");
    if (e instanceof PermissionDeniedError) redirect("/admin");
    throw e;
  }

  const session = await auth();
  const permissions = session?.user?.id
    ? await getPermissionsForUser(session.user.id)
    : new Set<string>();
  const canStaff = permissions.has("staff.view");
  const canSettings = permissions.has("settings.view");

  const sections: Section[] = [];

  if (canStaff) {
    sections.push({
      label: "Team & access",
      cards: [
        {
          href: "/admin/settings/staff",
          title: "Team members",
          desc: "Invite teammates by email, set their role, and fine-tune one person’s rights with per-action overrides.",
          icon: Users,
        },
        {
          href: "/admin/settings/roles",
          title: "Role access",
          desc: "Edit what each role can view, create, edit or delete — per area, including finance. Ungranted areas stay hidden.",
          icon: ShieldCheck,
        },
      ],
    });
  }

  if (canSettings) {
    sections.push({
      label: "Storefront & content",
      cards: [
        {
          href: "/admin/settings/storefront",
          title: "Storefront",
          desc: "Lead-time promise, WhatsApp and Instagram links, brand name and announcement.",
          icon: Store,
        },
        {
          href: "/admin/content",
          title: "Content & pages",
          desc: "Homepage, nav, announcements, static pages and the size-guide copy.",
          icon: FileText,
        },
      ],
    });

    sections.push({
      label: "Catalogue & sizing",
      cards: [
        {
          href: "/admin/settings/sizing/categories",
          title: "Garment categories",
          desc: "Piece types and the measurement keys each one uses.",
          icon: Ruler,
        },
        {
          href: "/admin/settings/sizing/blocks",
          title: "Size charts",
          desc: "The standard house charts every design starts from.",
          icon: Ruler,
        },
        {
          href: "/admin/settings/sizing/chart",
          title: "Size chart tool",
          desc: "Build and grade charts; recognise styles from a photo.",
          icon: Ruler,
        },
        {
          href: "/admin/settings/studio",
          title: "AI Studio",
          desc: "Defaults, prompt template and the AI models used for design and try-on.",
          icon: Palette,
        },
      ],
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Eyebrow>Settings</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">Settings</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-chalk">
          People and permissions, the storefront, and how the catalogue is
          sized — everything that shapes the house runs from here.
        </p>
      </div>

      {sections.length === 0 ? (
        <p className="border border-indigo-lift p-4 text-[13px] text-chalk">
          You don’t have access to any settings. Ask an owner if you need it.
        </p>
      ) : (
        sections.map((section) => (
          <section key={section.label} className="flex flex-col gap-3">
            <h2 className="font-sans text-[10.5px] uppercase tracking-[0.2em] text-chalk">
              {section.label}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {section.cards.map((card) => (
                <SettingsCard key={card.href} card={card} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
