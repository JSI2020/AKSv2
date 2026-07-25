import { PrimitivesDemo } from "./primitives-demo";

const COLORS = [
  { name: "greige", token: "--color-greige", className: "bg-greige" },
  {
    name: "greige-deep",
    token: "--color-greige-deep",
    className: "bg-greige-deep",
  },
  { name: "ink", token: "--color-ink", className: "bg-ink" },
  { name: "indigo", token: "--color-indigo", className: "bg-indigo" },
  {
    name: "indigo-lift",
    token: "--color-indigo-lift",
    className: "bg-indigo-lift",
  },
  { name: "chalk", token: "--color-chalk", className: "bg-chalk" },
  { name: "zari", token: "--color-zari", className: "bg-zari" },
  { name: "madder", token: "--color-madder", className: "bg-madder" },
] as const;

const TYPE_SIZES = [
  { label: "Display XL", className: "font-display text-5xl font-medium" },
  { label: "Display L", className: "font-display text-4xl font-medium" },
  { label: "Display M", className: "font-display text-3xl font-medium" },
  { label: "UI XL", className: "font-sans text-xl font-medium" },
  { label: "UI L", className: "font-sans text-lg" },
  { label: "UI M (admin 13px)", className: "font-sans text-[13px]" },
  { label: "UI S", className: "font-sans text-sm" },
  { label: "UI XS / eyebrow", className: "font-sans text-xs uppercase tracking-[0.12em]" },
  { label: "Data L", className: "font-data text-lg tabular-nums" },
  { label: "Data M", className: "font-data text-sm tabular-nums" },
  { label: "Data S", className: "font-data text-xs tabular-nums" },
  {
    label: "Urdu UI",
    className: "font-urdu text-base",
    sample: "عکس — آپ کا عکس، سلائی سے",
    dir: "rtl" as const,
  },
] as const;

export default function TokensPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <p className="mb-2 font-sans text-xs uppercase tracking-[0.12em] text-chalk">
        AKS · design tokens
      </p>
      <h1 className="font-display text-4xl text-greige">Tokens</h1>
      <p className="mt-2 max-w-2xl text-chalk">
        Colour and type foundation. Hex lives only in the theme block.
      </p>

      <section className="mt-12">
        <h2 className="mb-4 font-sans text-xs uppercase tracking-[0.12em] text-chalk">
          Colour
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {COLORS.map((c) => (
            <li key={c.name} className="border border-indigo-lift p-3">
              <div className={`mb-3 block-size-16 w-full ${c.className}`} />
              <p className="font-sans text-sm text-greige">{c.name}</p>
              <p className="font-data text-xs text-chalk">{c.token}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="mb-4 font-sans text-xs uppercase tracking-[0.12em] text-chalk">
          Type
        </h2>
        <ul className="flex flex-col gap-6 border border-indigo-lift p-6">
          {TYPE_SIZES.map((t) => (
            <li key={t.label}>
              <p className="mb-1 font-sans text-xs uppercase tracking-[0.12em] text-chalk">
                {t.label}
              </p>
              <p
                className={`text-greige ${t.className}`}
                dir={"dir" in t ? t.dir : undefined}
                lang={"dir" in t ? "ur" : undefined}
              >
                {"sample" in t && t.sample
                  ? t.sample
                  : "AKS by Shahneela — your reflection, stitched. 0123456789"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 border border-indigo-lift p-6">
        <h2 className="mb-4 font-sans text-xs uppercase tracking-[0.12em] text-chalk">
          Radius & shadow
        </h2>
        <p className="font-sans text-sm text-greige">
          Global radius: 2px. Box shadows: disabled.
        </p>
        <div className="mt-4 flex gap-4">
          <div className="block-size-16 inline-size-16 bg-zari" />
          <div className="block-size-16 inline-size-16 border border-chalk bg-indigo-lift" />
        </div>
      </section>

      <PrimitivesDemo />
    </main>
  );
}
