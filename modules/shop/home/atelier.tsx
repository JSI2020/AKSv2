import { Reveal } from "./reveal";

const SIG_ICONS = [
  <svg key="1" viewBox="0 0 24 24">
    <path d="M4 7 L12 3 L20 7 L20 20 L4 20 Z" />
    <path d="M12 3 L12 20" />
    <path d="M8 9 Q12 12 16 9" />
  </svg>,
  <svg key="2" viewBox="0 0 24 24">
    <path d="M6 4 L6 20 M18 4 L18 20" />
    <path d="M6 8 Q12 5 18 8 M6 16 Q12 13 18 16" />
  </svg>,
  <svg key="3" viewBox="0 0 24 24">
    <path d="M4 6 Q12 4 20 6 L20 16 Q12 22 4 16 Z" />
    <path d="M4 12 Q12 10 20 12" strokeDasharray="2 2" />
  </svg>,
  <svg key="4" viewBox="0 0 24 24">
    <circle cx="8" cy="8" r="2.5" />
    <circle cx="8" cy="16" r="2.5" />
    <path d="M13 8 L20 8 M13 16 L20 16" />
  </svg>,
  <svg key="5" viewBox="0 0 24 24">
    <path d="M12 3 L12 21" />
    <path d="M12 6 L7 9 M12 6 L17 9 M12 12 L8 14 M12 12 L16 14" />
  </svg>,
  <svg key="6" viewBox="0 0 24 24">
    <path d="M4 5 L20 5 M4 5 L4 8 M20 5 L20 8" />
    <path d="M7 5 L7 7 M11 5 L11 7 M15 5 L15 7 M19 5 L19 7" />
    <path d="M6 12 Q12 10 18 12 L17 20 Q12 22 7 20 Z" />
  </svg>,
] as const;

export async function Atelier({
  signatures,
  eyebrow = "The atelier",
  title = "Cut by hand, in natural cloth.",
  p1 = "Construction is the product: hidden pockets, covered fabric buttons, deep curved hems, panels cut into the cloth and never gathered on. Cut by hand, finished with care, made to outlast the season.",
  p2 = "The fusion lives in the line, never a logo.",
  aksLine,
}: {
  signatures: string[];
  eyebrow?: string;
  title?: string;
  p1?: string;
  p2?: string;
  aksLine?: React.ReactNode;
}) {
  return (
    <Reveal className="making" id="making">
      <div className="making-in">
        <div className="making-txt">
          <span className="eyebrow">{eyebrow}</span>
          <h2 className="serif">{title}</h2>
          <p>{p1}</p>
          <p>{p2}</p>
          <div className="ur urdu" lang="ur">
            عکس
          </div>
          {aksLine ? <p style={{ fontSize: "13px" }}>{aksLine}</p> : null}
        </div>
        <div className="signatures">
          {signatures.map((text, i) => (
            <div key={`${text}-${i}`} className="sig">
              <span className="ic">{SIG_ICONS[i % SIG_ICONS.length]}</span>
              <span className="t">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
