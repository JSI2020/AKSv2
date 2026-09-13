/**
 * Real fabric drape / texture photos from Pexels (free licence).
 * https://www.pexels.com/license/
 *
 * Prefer spiral or folded drape shots where available.
 */
export type FabricPhotoSource = {
  /** Pexels photo id */
  pexelsId: number;
  /** Photographer credit for internal reference */
  credit: string;
};

/** Launch fabric file → Pexels source (colour-matched draped textile). */
export const DEMO_FABRIC_PHOTO_SOURCES: Record<string, FabricPhotoSource> = {
  "demo-white-jersey.jpg": { pexelsId: 11098224, credit: "Jessica Lewis" },
  "demo-olive-silk.jpg": { pexelsId: 7794356, credit: "Monstera Production" },
  "demo-russian-silk.jpg": { pexelsId: 36068827, credit: "Sebastian Luna" },
  "demo-ivory-lawn.jpg": { pexelsId: 8850650, credit: "Varvara Galvas" }, // ivory creased
  "demo-bone-poplin.jpg": { pexelsId: 15679399, credit: "Lisett Kruusimäe" },
  "demo-sand-linen.jpg": { pexelsId: 1460890, credit: "Pexels" },
  "demo-stone-khaddar.jpg": { pexelsId: 32763236, credit: "Miff Ibra" },
  "demo-taupe-twill.jpg": { pexelsId: 10221752, credit: "Engin Akyurt" },
  "demo-oyster-voile.jpg": { pexelsId: 7988395, credit: "Tamanna Rumee" },
  "demo-milk-crepe.jpg": { pexelsId: 3099298, credit: "Oussama Bergaoui" },
  "demo-espresso-corduroy.jpg": { pexelsId: 4863008, credit: "Kaboompics" },
  "demo-soft-olive-chiffon.jpg": { pexelsId: 19200738, credit: "Diana" },
  "demo-antique-gold-brocade.jpg": { pexelsId: 36299798, credit: "Jonathan Borba" },
  "demo-tea-rose-georgette.jpg": { pexelsId: 19856114, credit: "Diana" },
  "demo-charcoal-denim.jpg": { pexelsId: 36106019, credit: "Saifee Art" },
  "demo-pearl-satin.jpg": { pexelsId: 7988395, credit: "Tamanna Rumee" },
  "demo-sage-muslin.jpg": { pexelsId: 7641221, credit: "Eva Bronzini" },
  "demo-blush-jersey.jpg": { pexelsId: 19856109, credit: "Diana" },
  "demo-navy-wool-blend.jpg": { pexelsId: 36299799, credit: "Jonathan Borba" },
  "demo-cream-organza.jpg": { pexelsId: 15679399, credit: "Lisett Kruusimäe" },
  "demo-rust-linen-blend.jpg": { pexelsId: 7232407, credit: "Artem Podrez" },
  "demo-slate-gabardine.jpg": { pexelsId: 14840511, credit: "Engin Akyurt" },
  "demo-honey-raw-silk.jpg": { pexelsId: 36299798, credit: "Jonathan Borba" },
  "demo-fog-viscose.jpg": { pexelsId: 3099298, credit: "Oussama Bergaoui" },
  "demo-copper-velvet.jpg": { pexelsId: 34860701, credit: "3D Render" },
  "demo-pistachio-sateen.jpg": { pexelsId: 8465936, credit: "Davis Vidal" },
  "demo-aubergine-silk-blend.jpg": { pexelsId: 4863033, credit: "Kaboompics" },
  "demo-wheat-herringbone.jpg": { pexelsId: 33980188, credit: "Tomás Asurmendi" },
  "demo-sky-cotton-voile.jpg": { pexelsId: 34860693, credit: "3D Render" },
  "demo-rose-modal.jpg": { pexelsId: 19856109, credit: "Diana" },
};

export function pexelsDownloadUrl(pexelsId: number, size = 900): string {
  return `https://images.pexels.com/photos/${pexelsId}/pexels-photo-${pexelsId}.jpeg?auto=compress&cs=tinysrgb&w=${size}&h=${size}&fit=crop`;
}
