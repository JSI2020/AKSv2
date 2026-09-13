/**
 * House model roster — pick one per design (or random).
 * Within a design, the same persona + seed stays locked for refine rounds.
 * Descriptions are intentionally distinct so faces do not all look the same.
 */

export type ModelPersona = {
  /** Tasteful catalogue-model description injected into every prompt. */
  description: string;
  /** Fixed seed so the same face / look recurs across generations. */
  seed: number;
  /** When true, the seed is always passed to the model. */
  lockSeed: boolean;
};

export type HouseModel = ModelPersona & {
  id: string;
  /** Short label for the UI. */
  name: string;
  /** One-line cue shown under the name. */
  cue: string;
};

/** House models — clearly differentiated looks, modest commercial tone. */
export const HOUSE_MODELS: HouseModel[] = [
  {
    id: "ayesha",
    name: "Ayesha",
    cue: "Classic oval · fair-wheatish · long waves",
    description:
      "Distinct face identity: young Pakistani woman, fair-to-wheatish skin, oval face, narrow nose, arched brows, deep brown almond eyes, long loosely waved black hair past the shoulders with a centre part, soft half-smile. Do not blend her with other models.",
    seed: 42_861_793,
    lockSeed: true,
  },
  {
    id: "zara",
    name: "Zara",
    cue: "Round soft · warm beige · bob waves",
    description:
      "Distinct face identity: young Pakistani woman, warm beige skin, softer rounder face, fuller cheeks, wide gentle brown eyes, shorter shoulder-length dark brown hair with soft waves and face-framing pieces, quiet smile. Visibly different from sharper-featured models.",
    seed: 19_204_557,
    lockSeed: true,
  },
  {
    id: "noor",
    name: "Noor",
    cue: "High cheekbones · light olive · low bun",
    description:
      "Distinct face identity: young South Asian woman, light olive luminous skin, higher cheekbones, slightly longer face, dark almond eyes, sleek black hair pulled into a low neat bun exposing the ears and neck, polished soft smile. Editorial bone structure — not a soft round face.",
    seed: 77_331_902,
    lockSeed: true,
  },
  {
    id: "sana",
    name: "Sana",
    cue: "Heart face · wheatish glow · straight mid hair",
    description:
      "Distinct face identity: young Pakistani woman, wheatish glowing skin, heart-shaped face with a narrower chin, straight mid-length jet-black hair with blunt ends, defined brows, expressive dark eyes, subtle closed-mouth smile. Contemporary and clean — not a bun or waves look.",
    seed: 55_018_446,
    lockSeed: true,
  },
  {
    id: "hiba",
    name: "Hiba",
    cue: "Petite delicate · fair porcelain · centre part",
    description:
      "Distinct face identity: young South Asian woman, fair porcelain skin, more delicate petite facial features, softer jaw, fine dark brows, large soft eyes, dark hair with a clean centre parting falling straight beside the face, quiet bright smile. Smaller-boned look than statuesque models.",
    seed: 31_667_120,
    lockSeed: true,
  },
  {
    id: "maryam",
    name: "Maryam",
    cue: "Statuesque square · medium warm · tied back",
    description:
      "Distinct face identity: young Pakistani woman, medium warm complexion, taller presence, stronger elegant jawline (slightly square), deep-set brown eyes, long dark hair loosely tied back with volume at the crown, composed soft smile. Clearly more statuesque than petite models.",
    seed: 90_452_318,
    lockSeed: true,
  },
  {
    id: "laiba",
    name: "Laiba",
    cue: "Youthful · honey beige · curly-wavy fringe",
    description:
      "Distinct face identity: young South Asian woman, honey-beige skin, youthful rounded features, bright rounder dark eyes, dark hair with soft curly-wavy texture and light fringe/pieces around the forehead, open natural smile that reaches the eyes. Younger playful energy — not regal or severe.",
    seed: 12_889_704,
    lockSeed: true,
  },
  {
    id: "fatima",
    name: "Fatima",
    cue: "Regal · dusky wheatish · sleek ponytail",
    description:
      "Distinct face identity: young Pakistani woman, dusky wheatish skin, more mature regal features, thicker dark brows, intense expressive eyes, thick black hair in a smooth high or mid ponytail, serious-soft closed-mouth smile. Stronger contrast and presence than soft natural looks.",
    seed: 64_173_059,
    lockSeed: true,
  },
  {
    id: "iqra",
    name: "Iqra",
    cue: "Angular editorial · fair olive · cropped bob",
    description:
      "Distinct face identity: young South Asian woman, fair-olive skin, cleaner angular editorial features, sharper jaw, cropped-to-shoulder sleek black bob with tucked-behind-ear styling, focused friendly eyes, hint of a smile. Short hair — must not look long-haired.",
    seed: 48_920_611,
    lockSeed: true,
  },
  {
    id: "areeba",
    name: "Areeba",
    cue: "Approachable · golden wheat · side part long",
    description:
      "Distinct face identity: young Pakistani woman, golden-wheat complexion, warmer approachable face, softer nose bridge, dark brown eyes, long straight black hair with a clear side part and length past mid-back, friendly natural smile. Warm and open — not cold editorial.",
    seed: 27_506_884,
    lockSeed: true,
  },
  {
    id: "mahnoor",
    name: "Mahnoor",
    cue: "Dramatic · deep warm tone · swept back",
    description:
      "Distinct face identity: young South Asian woman, deep warm brown complexion (noticeably deeper than fair models), dramatic features, striking dark eyes, rich black hair swept fully back off the forehead, longer elegant neck, composed soft smile. Deep skin tone must remain clearly deeper than wheatish models.",
    seed: 83_114_275,
    lockSeed: true,
  },
  {
    id: "rida",
    name: "Rida",
    cue: "Minimal · light wheatish · neat shoulder cut",
    description:
      "Distinct face identity: young Pakistani woman, light wheatish clear skin, minimal modern features, soft brown eyes, neat blunt shoulder-length dark hair with almost no wave, barely-there makeup, tranquil gentle smile. Ultra-minimal styling — not glamorous or dramatic.",
    seed: 5_738_162,
    lockSeed: true,
  },
  {
    id: "meher",
    name: "Meher",
    cue: "Soft square · medium olive · half-up braid",
    description:
      "Distinct face identity: young Pakistani woman, medium olive skin, soft square jaw with gentle cheek fullness, warm brown eyes, dark hair in a neat half-up braid with the rest falling in soft waves past the shoulders, calm closed-mouth smile. Braided half-up look — not a full bun or ponytail.",
    seed: 36_741_208,
    lockSeed: true,
  },
  {
    id: "sadia",
    name: "Sadia",
    cue: "Long face · cool fair · soft curls",
    description:
      "Distinct face identity: young South Asian woman, cool fair skin with soft pink undertone, longer narrow face, refined nose, grey-brown soft eyes, dark hair in loose soft curls to mid-back with a gentle off-centre part, serene half-smile. Cooler undertone and curls — not straight or warm-golden skin.",
    seed: 71_592_443,
    lockSeed: true,
  },
  {
    id: "anaya",
    name: "Anaya",
    cue: "Round cheerful · caramel · shoulder braid",
    description:
      "Distinct face identity: young Pakistani woman, caramel-tan skin, cheerful round face, bright wide-set dark eyes, thick brows, dark hair in a single loose braid draped over one shoulder with a few face-framing wisps, warm open smile. Single shoulder braid and caramel tone — not fair or severe.",
    seed: 14_308_976,
    lockSeed: true,
  },
  {
    id: "bisma",
    name: "Bisma",
    cue: "Diamond face · warm bronze · curtain bangs",
    description:
      "Distinct face identity: young South Asian woman, warm bronze complexion, diamond-shaped face with wider cheekbones and a narrower chin, dark expressive eyes, black hair with soft curtain bangs and length to the collarbone, subtle smile. Curtain bangs and bronze skin must stay distinct from blunt or swept-back styles.",
    seed: 58_267_031,
    lockSeed: true,
  },
  {
    id: "emaan",
    name: "Emaan",
    cue: "Polished oval · ivory fair · French twist",
    description:
      "Distinct face identity: young Pakistani woman, ivory-fair luminous skin, polished oval face, arched brows, soft brown eyes, dark hair in a neat low French twist with a clean hairline, refined closed-mouth smile. Upswept twist styling — not loose hair or a simple ponytail.",
    seed: 93_815_620,
    lockSeed: true,
  },
  {
    id: "hania",
    name: "Hania",
    cue: "Soft heart · peach beige · messy bun tendrils",
    description:
      "Distinct face identity: young Pakistani woman, peach-beige skin, soft heart-shaped face, large soft brown eyes, dark hair in a loose messy top bun with soft tendrils framing the cheeks and neck, gentle natural smile. Messy bun with tendrils — not sleek or straightened.",
    seed: 22_459_187,
    lockSeed: true,
  },
  {
    id: "kiran",
    name: "Kiran",
    cue: "Angular cool · cool brown · side-swept long",
    description:
      "Distinct face identity: young South Asian woman, cool medium-brown skin, angular cheekbones, straighter brows, deep-set dark eyes, very long sleek black hair swept to one side with volume at the crown, composed soft smile. Cool undertone and dramatic side sweep — not warm golden or short hair.",
    seed: 67_104_852,
    lockSeed: true,
  },
  {
    id: "laila",
    name: "Laila",
    cue: "Fuller features · rich medium · voluminous waves",
    description:
      "Distinct face identity: young Pakistani woman, rich medium-brown skin, fuller soft features with a wider smile-ready mouth, warm dark eyes, thick black hair in voluminous mid-length waves with lots of body and a soft centre part, friendly closed-mouth smile. Volume and fuller features — not delicate or flat hair.",
    seed: 41_736_509,
    lockSeed: true,
  },
  {
    id: "nadia",
    name: "Nadia",
    cue: "Rectangular · light golden · chin-length crop",
    description:
      "Distinct face identity: young South Asian woman, light golden skin, longer rectangular face with a straighter jaw, thoughtful brown eyes, dark hair in a sleek chin-length crop with a soft side part, quiet intelligent smile. Short chin-length crop — must not look shoulder-length or longer.",
    seed: 8_921_374,
    lockSeed: true,
  },
  {
    id: "yusra",
    name: "Yusra",
    cue: "Soft oval · warm olive · layered waterfall",
    description:
      "Distinct face identity: young Pakistani woman, warm olive skin, soft oval face, gentle brows, amber-brown eyes, dark hair cut in long layered waterfall lengths that move past the shoulders, soft half-smile. Layered movement and warm olive — not a blunt cut or deep complexion.",
    seed: 75_608_291,
    lockSeed: true,
  },
  {
    id: "zoya",
    name: "Zoya",
    cue: "Petite round · fair rosy · soft side plaits",
    description:
      "Distinct face identity: young South Asian woman, fair rosy skin, petite round face, large soft eyes, fine features, dark hair styled in two soft loose side plaits resting forward on the shoulders, bright gentle smile. Twin soft plaits and petite scale — not a single braid or statuesque look.",
    seed: 33_184_760,
    lockSeed: true,
  },
];

export const DEFAULT_HOUSE_MODEL = HOUSE_MODELS[0]!;

export const DEFAULT_MODEL_PERSONA: ModelPersona = {
  description: DEFAULT_HOUSE_MODEL.description,
  seed: DEFAULT_HOUSE_MODEL.seed,
  lockSeed: DEFAULT_HOUSE_MODEL.lockSeed,
};

export const RANDOM_HOUSE_MODEL_ID = "random" as const;

export type HouseModelSelection = typeof RANDOM_HOUSE_MODEL_ID | string;

export function getHouseModelById(id: string): HouseModel | undefined {
  return HOUSE_MODELS.find((m) => m.id === id);
}

export function pickRandomHouseModel(excludeId?: string): HouseModel {
  const pool = excludeId
    ? HOUSE_MODELS.filter((m) => m.id !== excludeId)
    : HOUSE_MODELS;
  const list = pool.length ? pool : HOUSE_MODELS;
  const index = Math.floor(Math.random() * list.length);
  return list[index]!;
}

export function resolveHouseModel(
  selection?: HouseModelSelection | null,
): HouseModel {
  if (!selection || selection === RANDOM_HOUSE_MODEL_ID) {
    return pickRandomHouseModel();
  }
  return getHouseModelById(selection) ?? DEFAULT_HOUSE_MODEL;
}

export function getModelPersona(
  override?: Partial<ModelPersona>,
): ModelPersona {
  return {
    ...DEFAULT_MODEL_PERSONA,
    ...override,
  };
}

export function resolvePersonaSeed(
  persona: ModelPersona = getModelPersona(),
): number | undefined {
  return persona.lockSeed ? persona.seed : undefined;
}

export function houseModelToPersona(model: HouseModel): ModelPersona {
  return {
    description: model.description,
    seed: model.seed,
    lockSeed: model.lockSeed,
  };
}
