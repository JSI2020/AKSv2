import Link from "next/link";
import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import {
  listGarmentCategories,
  listMeasurementKeys,
} from "@/modules/sizing";

export default async function SizingCategoriesPage() {
  let categories;
  let keys;
  try {
    [categories, keys] = await Promise.all([
      listGarmentCategories(),
      listMeasurementKeys(),
    ]);
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  const keyLabel = new Map(keys.map((k) => [k.key, k.label]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Settings · Sizing</Eyebrow>
          <h1 className="mt-1 font-display text-3xl text-greige">
            Categories
          </h1>
          <p className="mt-1 max-w-xl text-[13px] text-chalk">
            What gets measured, per garment type. Body charts are per category —
            length is a design decision, not a separate category.
          </p>
        </div>
        <Link
          href="/admin/settings/sizing/categories/new"
          className="border border-zari px-3 py-1.5 text-[13px] text-zari"
        >
          New category
        </Link>
      </div>

      <div className="border border-indigo-lift">
        <div className="border-b border-indigo-lift px-3 py-2">
          <p className="font-sans text-[12px] uppercase tracking-[0.12em] text-chalk">
            Garment categories · {categories.length}
          </p>
        </div>
        <ul className="divide-y divide-indigo-lift">
          {categories.map((cat) => (
            <li key={cat.id}>
              <Link
                href={`/admin/settings/sizing/categories/${cat.id}`}
                className="flex flex-col gap-1 px-3 py-3 hover:bg-indigo-lift/40"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-[13px] text-greige">
                      {cat.name}
                      <span className="ms-2 font-urdu text-chalk" dir="rtl">
                        {cat.nameUr}
                      </span>
                    </p>
                    <p className="font-data text-[11px] text-chalk">{cat.key}</p>
                  </div>
                  <p className="font-sans text-[11px] uppercase tracking-[0.08em] text-chalk">
                    {cat.active ? "Active" : "Inactive"} · sort {cat.sortOrder}
                  </p>
                </div>
                <p className="font-data text-[11px] leading-relaxed text-chalk">
                  {cat.measurementKeys
                    .map((k) => keyLabel.get(k) ?? k)
                    .join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
