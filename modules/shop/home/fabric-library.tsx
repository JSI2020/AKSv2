import { getTranslations } from "next-intl/server";

import { Reveal } from "./reveal";

const FABRICS = [
  {
    weave: "weave-crepe",
    nameKey: "fabricCrepeName",
    chKey: "fabricCrepeCh",
    whereKey: "fabricCrepeWhere",
  },
  {
    weave: "weave-khaddi",
    nameKey: "fabricKhaddiName",
    chKey: "fabricKhaddiCh",
    whereKey: "fabricKhaddiWhere",
  },
  {
    weave: "weave-silk",
    nameKey: "fabricSilkName",
    chKey: "fabricSilkCh",
    whereKey: "fabricSilkWhere",
  },
  {
    weave: "weave-organza",
    nameKey: "fabricOrganzaName",
    chKey: "fabricOrganzaCh",
    whereKey: "fabricOrganzaWhere",
  },
] as const;

export async function FabricLibrary() {
  const t = await getTranslations("HomeProto");

  return (
    <Reveal as="section" className="fabric" id="fabric">
      <div className="fabric-in">
        <div className="fabric-head">
          <span className="eyebrow">{t("fabricEyebrow")}</span>
          <h2 className="serif">{t("fabricTitle")}</h2>
          <p>{t("fabricLead")}</p>
        </div>
        <div className="fabrics">
          {FABRICS.map((f) => (
            <div key={f.weave} className="fab">
              <div className={`sw ${f.weave}`} />
              <h4 className="serif">{t(f.nameKey)}</h4>
              <div className="ch">{t(f.chKey)}</div>
              <div className="where">{t(f.whereKey)}</div>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
