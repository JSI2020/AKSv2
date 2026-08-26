import { getTranslations } from "next-intl/server";

import { listFeaturedFabrics } from "@/modules/shop/fabrics/queries";

import { Reveal } from "./reveal";

// Decorative swatch textures, rotated by index. The fabric *content*
// (name, hand, composition) comes from the admin Fabric library.
const WEAVE_CLASSES = [
  "weave-crepe",
  "weave-khaddi",
  "weave-silk",
  "weave-organza",
] as const;

export async function FabricLibrary() {
  const t = await getTranslations("HomeProto");
  const fabrics = await listFeaturedFabrics(4);

  if (fabrics.length === 0) return null;

  return (
    <Reveal as="section" className="fabric" id="fabric">
      <div className="fabric-in">
        <div className="fabric-head">
          <span className="eyebrow">{t("fabricEyebrow")}</span>
          <h2 className="serif">{t("fabricTitle")}</h2>
          <p>{t("fabricLead")}</p>
        </div>
        <div className="fabrics">
          {fabrics.map((f, i) => (
            <div key={f.id} className="fab">
              <div
                className={`sw ${WEAVE_CLASSES[i % WEAVE_CLASSES.length]}`}
              />
              <h4 className="serif">{f.name}</h4>
              <div className="ch">{f.drapeNotes || f.composition}</div>
              <div className="where">{f.composition}</div>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}
