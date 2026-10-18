import type { LegalDocument } from "./documents";

const SHIPPING_PATH = "/pages/shipping-returns";

function Paragraph({ text }: { text: string }) {
  const parts = text.split(
    /(\[OWNER:[^\]]+\]|\/pages\/shipping-returns)/g,
  );
  return (
    <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith("[OWNER:")) {
          return (
            <mark key={index} className="legal-placeholder">
              {part}
            </mark>
          );
        }
        if (part === SHIPPING_PATH) {
          return (
            <a key={index} href={SHIPPING_PATH} className="underline">
              shipping and returns
            </a>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </p>
  );
}

export function LegalDocumentView({ document }: { document: LegalDocument }) {
  return (
    <main className="mx-auto max-w-[720px] px-[2.5rem] pb-24 pt-28 max-[900px]:px-[1.4rem]">
      <p
        className="text-[12px] uppercase tracking-[0.14em]"
        style={{ color: "var(--stone)" }}
      >
        AKS
      </p>
      <h1 className="serif mt-3 text-[clamp(2rem,4vw,2.8rem)] font-light leading-none">
        {document.title}
      </h1>
      <p className="mt-4 text-[13px]" style={{ color: "var(--stone)" }}>
        Last updated {document.updated}
      </p>
      {document.sections.map((section) => (
        <section key={section.heading} className="mt-10">
          <h2 className="serif text-[1.35rem] font-light leading-tight">
            {section.heading}
          </h2>
          {section.paragraphs.map((paragraph) => (
            <Paragraph key={paragraph} text={paragraph} />
          ))}
        </section>
      ))}
    </main>
  );
}
