import { renderAccentText } from "@/modules/content/accent-text";

import { Reveal } from "./reveal";

export function HomeStatement({ text }: { text: string }) {
  return (
    <Reveal className="statement">
      <p>{renderAccentText(text)}</p>
    </Reveal>
  );
}
