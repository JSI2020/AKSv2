/**
 * Modest pret product photos from small Chinese / regional boutiques
 * (testing only — never famous Pakistani labels).
 *
 * Sources: Nüwa Hanfu, HUI Modest — curated apparel only.
 */
import type { CatalogueLook } from "../packages/db/house-catalogue-looks";

export type DesignPhotoTriplet = {
  /** FRONT, THREE_QUARTER, BACK */
  urls: [string, string, string];
  credit: string;
  productTitle: string;
};

type ShopifyImage = { src: string; width?: number; height?: number };
type ShopifyProduct = {
  title: string;
  body_html?: string;
  product_type?: string;
  tags?: string[];
  images: ShopifyImage[];
};

const BOUTIQUE_STORES = [
  { baseUrl: "https://nuwahanfu.com", credit: "nuwahanfu.com (CN)" },
  { baseUrl: "https://huimodest.com", credit: "huimodest.com (CN)" },
] as const;

/** Hard reject junk AliExpress-style listings. */
const REJECT_RE =
  /lingerie|panty|panties|thong|g-string|sexy|erotic|babydoll|intimate|underwear|bra\b|watch|handbag|bag\b|dog|pet|puppy|hammock|light\b|switch|gateway|shoe|boot|bracelet|buddha|phone|case|charger|sensor|aqara|yeelight|geneva|wallet|socks|bonnet|underscarf|hat\b|cap\b|hairpin|hair pin|braces|belt|doily|slip dress|accessory|earrings|necklace|bangle|comb\b|fan\b|umbrella/i;

const ALLOW_RE =
  /dress|qipao|cheongsam|hanfu|robe|abaya|kaftan|caftan|tunic|blouse|shirt|skirt|trouser|pant|palazzo|gown|maxi|jumpsuit|set\b|jacket|vest|coat|cardigan|top\b|outer|mamian|linen|ramie|hemp|silk/i;

const CATEGORY_RULES: Record<CatalogueLook["category"], RegExp> = {
  KAMEEZ:
    /kurta|kameez|tunic|blouse|shirt|top\b|cardigan|jacket|vest|outer|qipao top/i,
  TROUSER: /trouser|pant(?!y)|palazzo|wide-?leg|bottom|culotte|legging/i,
  DUPATTA: /dupatta|stole|shawl|scarf|wrap(?!per)/i,
  GOWN:
    /gown|maxi|kaftan|caftan|abaya|jilbab|dress|robe|cheongsam|qipao|hanfu|anarkali/i,
  SKIRT: /skirt|mamian|gharara|sharara/i,
};

function cleanUrl(src: string): string {
  const base = src.split("?")[0] ?? src;
  return `${base}?width=1200`;
}

function usableImages(images: ShopifyImage[]): string[] {
  return (images ?? [])
    .filter((i) => {
      const w = i.width ?? 1200;
      const h = i.height ?? 1600;
      // Prefer portrait / square product shots; skip tiny thumbs
      return w >= 700 && h >= 700;
    })
    .map((i) => cleanUrl(i.src))
    .filter(Boolean);
}

function isApparelProduct(product: ShopifyProduct): boolean {
  const text = `${product.title} ${product.product_type ?? ""} ${(product.tags ?? []).join(" ")}`;
  if (REJECT_RE.test(text)) return false;
  return ALLOW_RE.test(text);
}

function classifyProduct(product: ShopifyProduct): CatalogueLook["category"] {
  const text = `${product.title} ${(product.body_html ?? "").replace(/<[^>]+>/g, " ")}`;
  // Check more specific categories first
  for (const cat of [
    "TROUSER",
    "SKIRT",
    "DUPATTA",
    "GOWN",
    "KAMEEZ",
  ] as const) {
    if (CATEGORY_RULES[cat].test(text)) return cat;
  }
  return "GOWN";
}

function toTriplet(
  product: ShopifyProduct,
  credit: string,
): DesignPhotoTriplet | null {
  if (!isApparelProduct(product)) return null;
  const imgs = usableImages(product.images);
  if (imgs.length < 3) return null;
  return {
    urls: [imgs[0]!, imgs[1]!, imgs[2]!],
    credit,
    productTitle: product.title.slice(0, 80),
  };
}

async function fetchStoreProducts(baseUrl: string): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`${baseUrl}/products.json?limit=50&page=${page}`, {
      headers: { "User-Agent": "AKS-demo-seed/1.0" },
    });
    if (!res.ok) break;
    const json = (await res.json()) as { products?: ShopifyProduct[] };
    const batch = json.products ?? [];
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < 50) break;
  }
  return all;
}

export type DesignPhotoCatalog = Map<
  CatalogueLook["category"],
  DesignPhotoTriplet[]
>;

/** Fetch and bucket boutique product triplets by garment category. */
export async function fetchBoutiquePhotoCatalog(): Promise<DesignPhotoCatalog> {
  const catalog: DesignPhotoCatalog = new Map([
    ["KAMEEZ", []],
    ["TROUSER", []],
    ["DUPATTA", []],
    ["GOWN", []],
    ["SKIRT", []],
  ]);

  let total = 0;
  for (const store of BOUTIQUE_STORES) {
    const products = await fetchStoreProducts(store.baseUrl);
    let added = 0;
    for (const product of products) {
      const triplet = toTriplet(product, store.credit);
      if (!triplet) continue;
      const cat = classifyProduct(product);
      catalog.get(cat)!.push(triplet);
      added += 1;
      total += 1;
    }
    console.log(`  ${store.credit}: ${added} apparel product(s)`);
  }

  // Fill thin categories from gown/kameez pools (still real apparel).
  const fallbackPool = [
    ...(catalog.get("GOWN") ?? []),
    ...(catalog.get("KAMEEZ") ?? []),
    ...(catalog.get("SKIRT") ?? []),
  ];
  for (const cat of catalog.keys()) {
    if ((catalog.get(cat)?.length ?? 0) < 10 && fallbackPool.length) {
      catalog.set(cat, [...(catalog.get(cat) ?? []), ...fallbackPool]);
    }
  }

  if (total < 20) {
    throw new Error(
      `Only ${total} apparel photos found — check CN boutique reachability`,
    );
  }

  return catalog;
}

/** Pick three on-model angles for one design index + garment category. */
export function photoTripletForDesign(
  designIndex: number,
  category: CatalogueLook["category"],
  catalog: DesignPhotoCatalog,
): DesignPhotoTriplet {
  const pool =
    catalog.get(category) ??
    catalog.get("GOWN") ??
    catalog.get("KAMEEZ")!;
  // Spread across the pool so neighbouring designs don't share the same look.
  const stride = Math.max(1, Math.floor(pool.length / 10));
  return pool[(designIndex * stride) % pool.length]!;
}

export async function downloadDesignPhoto(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { "User-Agent": "AKS-demo-seed/1.0" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url.slice(0, 80)}…`);
  }
  return Buffer.from(await res.arrayBuffer());
}
