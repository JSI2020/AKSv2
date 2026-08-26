import { renderAccentText } from "@/modules/content/accent-text";

import { Reveal } from "./reveal";

export function HomeStatement({ text }: { text: string }) {
  return (
    <>
      <Reveal className="statement">
        <p>{renderAccentText(text)}</p>
      </Reveal>
      <Reveal className="flourish-divide">
        <svg viewBox="0 44 372 132" aria-hidden="true">
          <use href="#aks-flourish-geo" />
        </svg>
      </Reveal>
    </>
  );
}
