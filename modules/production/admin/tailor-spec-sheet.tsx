"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import type { TailorSpecSheet } from "../spec-sheet";

import "./tailor-spec-print.css";

type TailorSpecSheetViewProps = {
  sheet: TailorSpecSheet;
};

function formatDueDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function BilingualRow({
  labelEn,
  labelUr,
  valueEn,
  valueUr,
  prominent = false,
}: {
  labelEn: string;
  labelUr: string;
  valueEn: ReactNode;
  valueUr?: ReactNode;
  prominent?: boolean;
}) {
  return (
    <div
      className={
        prominent
          ? "grid grid-cols-2 gap-x-4 border-2 border-black py-2"
          : "grid grid-cols-2 gap-x-4 border-b border-black/30 py-1.5"
      }
    >
      <div>
        <p className="text-[11px] uppercase tracking-[0.08em] text-black/70">
          {labelEn}
        </p>
        <div
          className={
            prominent
              ? "mt-0.5 font-data text-[22px] font-semibold leading-tight"
              : "mt-0.5 text-[15px] leading-snug"
          }
        >
          {valueEn}
        </div>
      </div>
      <div dir="rtl" className="font-urdu text-end">
        <p className="text-[11px] text-black/70">{labelUr}</p>
        <div
          className={
            prominent
              ? "mt-0.5 font-data text-[22px] font-semibold leading-tight"
              : "mt-0.5 text-[15px] leading-snug"
          }
        >
          {valueUr ?? valueEn}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ en, ur }: { en: string; ur: string }) {
  return (
    <header className="mb-2 grid grid-cols-2 gap-x-4 border-b-2 border-black pb-1">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.1em]">
        {en}
      </h2>
      <h2
        dir="rtl"
        className="font-urdu text-end text-[14px] font-semibold tracking-normal"
      >
        {ur}
      </h2>
    </header>
  );
}

export function TailorSpecSheetView({ sheet }: TailorSpecSheetViewProps) {
  const sizeEn =
    sheet.sizeMode === "MADE_TO_MEASURE"
      ? "MADE TO MEASURE"
      : `Size ${sheet.sizeLabel ?? "—"}`;
  const sizeUr =
    sheet.sizeMode === "MADE_TO_MEASURE"
      ? "آپ کی پیمائش پر"
      : `سائز ${sheet.sizeLabel ?? "—"}`;

  return (
    <div className="mx-auto max-w-[210mm]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/admin/production"
          className="border border-chalk/40 px-3 py-1.5 text-[13px] text-greige hover:border-greige"
        >
          ← Production board
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="border border-greige bg-greige px-4 py-1.5 text-[13px] font-medium text-indigo"
        >
          Print spec sheet
        </button>
      </div>

      <article className="tailor-spec-sheet border-2 border-black bg-white p-5 text-black md:p-6">
        <header className="mb-4 border-b-2 border-black pb-3">
          <div className="grid grid-cols-2 gap-x-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-black/70">
                Tailor spec sheet
              </p>
              <h1 className="mt-1 font-display text-[26px] leading-none">
                {sheet.orderNumber}
              </h1>
            </div>
            <div dir="rtl" className="font-urdu text-end">
              <p className="text-[12px] text-black/70">کپڑے کی تفصیل</p>
              <p className="mt-1 text-[18px] font-semibold">{sheet.orderNumber}</p>
            </div>
          </div>
        </header>

        <section className="mb-4">
          <BilingualRow
            labelEn="Design"
            labelUr="ڈیزائن"
            valueEn={sheet.designName}
          />
          <BilingualRow
            labelEn="Colourway"
            labelUr="رنگ"
            valueEn={sheet.colourwayName}
            valueUr={sheet.colourwayNameUr}
          />
          <BilingualRow
            labelEn="Lot code"
            labelUr="لاٹ کوڈ"
            valueEn={
              <span className="font-data text-[18px] tracking-wide">
                {sheet.lotCode ?? "—"}
              </span>
            }
            valueUr={
              <span className="font-data text-[18px] tracking-wide">
                {sheet.lotCode ?? "—"}
              </span>
            }
            prominent={Boolean(sheet.lotCode)}
          />
        </section>

        <section className="mb-4">
          <BilingualRow
            labelEn="Size"
            labelUr="سائز"
            valueEn={sizeEn}
            valueUr={sizeUr}
            prominent
          />
        </section>

        <section className="mb-4">
          <SectionHeading en="Cut specification" ur="کٹنگ کی تفصیل" />
          <p className="mb-2 grid grid-cols-2 gap-x-4 text-[11px] text-black/70">
            <span>All values in inches. Tolerance ±0.5″ unless noted.</span>
            <span dir="rtl" className="font-urdu text-end">
              تمام پیمائشیں انچ میں۔ ±0.5″ کی گنجائش۔
            </span>
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-black text-[14px]">
              <thead>
                <tr className="border-b border-black bg-black/5">
                  <th className="border border-black/20 px-2 py-1.5 text-start text-[11px] uppercase tracking-[0.08em]">
                    Measurement
                  </th>
                  <th
                    dir="rtl"
                    className="border border-black/20 px-2 py-1.5 text-end font-urdu text-[12px]"
                  >
                    پیمائش
                  </th>
                  <th className="border border-black/20 px-2 py-1.5 text-end text-[11px] uppercase tracking-[0.08em]">
                    Inches
                  </th>
                </tr>
              </thead>
              <tbody>
                {sheet.cutRows.map((row) => (
                  <tr key={row.key} className="border-b border-black/20">
                    <td className="border border-black/10 px-2 py-2 text-[13px]">
                      {row.labelEn}
                    </td>
                    <td
                      dir="rtl"
                      className="border border-black/10 px-2 py-2 text-end font-urdu text-[13px]"
                    >
                      {row.labelUr}
                    </td>
                    <td className="border border-black/10 px-2 py-2 text-end font-data text-[20px] font-semibold tabular-nums leading-none">
                      {row.displayInches}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {sheet.customizations.length > 0 ? (
          <section className="mb-4">
            <SectionHeading en="Customization" ur="تبدیلیاں" />
            <ul className="space-y-1 text-[14px] leading-snug">
              {sheet.customizations.map((line) => (
                <li
                  key={line.en}
                  className="grid grid-cols-2 gap-x-4 border-b border-black/15 py-1"
                >
                  <span>{line.en}</span>
                  <span dir="rtl" className="font-urdu text-end">
                    {line.ur}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mb-4">
          <SectionHeading en="Fabric" ur="کپڑا" />
          <BilingualRow
            labelEn="Fabric"
            labelUr="کپڑے کا نام"
            valueEn={sheet.fabricName}
          />
          <BilingualRow
            labelEn="Metres allocated"
            labelUr="میٹر مختص"
            valueEn={
              <span className="font-data text-[18px]">
                {sheet.metresDisplay ?? "—"}
              </span>
            }
            valueUr={
              <span className="font-data text-[18px]">
                {sheet.metresDisplay ?? "—"}
              </span>
            }
          />
        </section>

        <section className="mb-4">
          <SectionHeading en="Trims required" ur="لوازمات" />
          {sheet.trims.length === 0 ? (
            <div className="grid grid-cols-2 gap-x-4 text-[14px] text-black/80">
              <p>None required.</p>
              <p dir="rtl" className="font-urdu text-end">
                کوئی نہیں۔
              </p>
            </div>
          ) : (
            <ul className="space-y-1 text-[14px]">
              {sheet.trims.map((trim) => (
                <li key={trim.name}>
                  {trim.name}
                  {trim.note ? ` — ${trim.note}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        {sheet.embroideryNotes || sheet.designRenderUrl ? (
          <section className="mb-4">
            <SectionHeading en="Embroidery" ur="کڑھائی" />
            {sheet.embroideryNotes ? (
              <div className="mb-3 grid grid-cols-2 gap-x-4 text-[14px] leading-snug">
                <p>{sheet.embroideryNotes}</p>
                <p dir="rtl" className="font-urdu text-end">
                  {sheet.embroideryNotes}
                </p>
              </div>
            ) : null}
            {sheet.designRenderUrl ? (
              <figure className="border border-black/30 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sheet.designRenderUrl}
                  alt=""
                  className="mx-auto max-h-[180px] w-auto object-contain grayscale contrast-125"
                />
                <figcaption className="mt-1 grid grid-cols-2 gap-x-4 text-[10px] text-black/70">
                  <span>Design render — embroidery placement reference</span>
                  <span dir="rtl" className="font-urdu text-end">
                    ڈیزائن — کڑھائی کی جگہ
                  </span>
                </figcaption>
              </figure>
            ) : null}
          </section>
        ) : null}

        <footer className="border-t-2 border-black pt-3">
          <BilingualRow
            labelEn="Due date"
            labelUr="آخری تاریخ"
            valueEn={formatDueDate(sheet.dueAt)}
            prominent
          />
        </footer>
      </article>
    </div>
  );
}
