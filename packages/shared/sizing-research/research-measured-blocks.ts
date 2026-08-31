/** AUTO-GENERATED — run `npx tsx scripts/generate-sizing-research-seeds.ts` */
import type { SizeBlockSeed } from "../size-block-seeds";

export type ResearchSizeBlockSeed = SizeBlockSeed & {
  sizeLabels: readonly string[];
  baseSizeLabel: string;
};

export const RESEARCH_MEASURED_BLOCK_SEEDS: readonly ResearchSizeBlockSeed[] = [
  {
    categoryKey: "KURTI",
    name: "KURTI research default",
    notes: "Research-backed default — body measurements (Anokherang charts). Replace with house pattern blocks when ready.",
    sizeLabels: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL", "7XL"],
    baseSizeLabel: "M",
    rows: [
      {
        measurementKey: "BUST",
        baseValue: 3600,
        gradeIncrement: 200,
        gradeOverrides: {},
        sortOrder: 10,
      },
      {
        measurementKey: "UPPER_WAIST",
        baseValue: 3200,
        gradeIncrement: 200,
        gradeOverrides: {},
        sortOrder: 20,
      },
      {
        measurementKey: "HIP",
        baseValue: 3800,
        gradeIncrement: 200,
        gradeOverrides: {},
        sortOrder: 30,
      },
      {
        measurementKey: "SHOULDER",
        baseValue: 1450,
        gradeIncrement: 30,
        gradeOverrides: {"S":0,"M":50,"L":50,"XL":0,"XXL":50,"3XL":50,"4XL":0,"5XL":50,"6XL":0,"7XL":50},
        sortOrder: 40,
      }
    ],
  },
  {
    categoryKey: "PANT",
    name: "PANT research default",
    notes: "Research-backed default — body measurements (Anokherang charts). Replace with house pattern blocks when ready.",
    sizeLabels: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL", "7XL"],
    baseSizeLabel: "M",
    rows: [
      {
        measurementKey: "WAIST",
        baseValue: 3200,
        gradeIncrement: 220,
        gradeOverrides: {"S":200,"M":200,"L":200,"XL":200,"XXL":200,"3XL":200,"4XL":200,"5XL":200,"6XL":400,"7XL":200},
        sortOrder: 10,
      },
      {
        measurementKey: "HIP",
        baseValue: 3800,
        gradeIncrement: 200,
        gradeOverrides: {},
        sortOrder: 20,
      },
      {
        measurementKey: "LENGTH",
        baseValue: 3800,
        gradeIncrement: 0,
        gradeOverrides: {},
        sortOrder: 30,
      }
    ],
  },
  {
    categoryKey: "PALAZZO",
    name: "PALAZZO research default",
    notes: "Research-backed default — body measurements (Anokherang charts). Replace with house pattern blocks when ready.",
    sizeLabels: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL", "7XL"],
    baseSizeLabel: "M",
    rows: [
      {
        measurementKey: "LOWER_WAIST",
        baseValue: 2800,
        gradeIncrement: 220,
        gradeOverrides: {"S":400,"M":200,"L":200,"XL":200,"XXL":200,"3XL":200,"4XL":200,"5XL":200,"6XL":200,"7XL":200},
        sortOrder: 10,
      },
      {
        measurementKey: "LENGTH",
        baseValue: 4200,
        gradeIncrement: 0,
        gradeOverrides: {},
        sortOrder: 20,
      }
    ],
  },
  {
    categoryKey: "LEHENGA",
    name: "LEHENGA research default",
    notes: "Research-backed default — body measurements (Anokherang charts). Replace with house pattern blocks when ready.",
    sizeLabels: ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL", "6XL", "7XL"],
    baseSizeLabel: "M",
    rows: [
      {
        measurementKey: "BUST",
        baseValue: 3600,
        gradeIncrement: 220,
        gradeOverrides: {"S":200,"M":200,"L":200,"XL":200,"XXL":200,"3XL":200,"4XL":200,"5XL":200,"6XL":300,"7XL":300},
        sortOrder: 10,
      },
      {
        measurementKey: "UPPER_WAIST",
        baseValue: 3000,
        gradeIncrement: 220,
        gradeOverrides: {"S":200,"M":200,"L":200,"XL":200,"XXL":200,"3XL":200,"4XL":200,"5XL":200,"6XL":300,"7XL":300},
        sortOrder: 20,
      },
      {
        measurementKey: "HIP",
        baseValue: 3800,
        gradeIncrement: 200,
        gradeOverrides: {},
        sortOrder: 30,
      },
      {
        measurementKey: "LOWER_WAIST",
        baseValue: 2800,
        gradeIncrement: 220,
        gradeOverrides: {"S":400,"M":200,"L":200,"XL":200,"XXL":200,"3XL":200,"4XL":200,"5XL":200,"6XL":200,"7XL":200},
        sortOrder: 40,
      },
      {
        measurementKey: "LENGTH",
        baseValue: 4200,
        gradeIncrement: 0,
        gradeOverrides: {},
        sortOrder: 50,
      }
    ],
  },
  {
    categoryKey: "KAMEEZ",
    name: "KAMEEZ research default",
    notes: "Research-backed default — finished/flat garment measurements (Rangreza / Sana Safinaz / Sapphire). Not body measurements.",
    sizeLabels: ["XXS", "XS", "S", "M", "L", "XL"],
    baseSizeLabel: "M",
    rows: [
      {
        measurementKey: "BUST",
        baseValue: 2000,
        gradeIncrement: 165,
        gradeOverrides: {"XS":175,"S":100,"M":125,"L":225,"XL":200},
        sortOrder: 10,
      },
      {
        measurementKey: "WAIST",
        baseValue: 1975,
        gradeIncrement: 163,
        gradeOverrides: {"S":100,"M":100,"L":250,"XL":200},
        sortOrder: 20,
      },
      {
        measurementKey: "HIP",
        baseValue: 2150,
        gradeIncrement: 150,
        gradeOverrides: {"S":50,"L":300,"XL":100},
        sortOrder: 30,
      },
      {
        measurementKey: "SHOULDER",
        baseValue: 1450,
        gradeIncrement: 63,
        gradeOverrides: {"S":50,"M":50,"L":100,"XL":50},
        sortOrder: 40,
      },
      {
        measurementKey: "SLEEVE_LENGTH",
        baseValue: 2250,
        gradeIncrement: 30,
        gradeOverrides: {"XS":50,"S":0,"M":50,"L":50,"XL":0},
        sortOrder: 50,
      },
      {
        measurementKey: "SLEEVE_OPENING",
        baseValue: 1200,
        gradeIncrement: 50,
        gradeOverrides: {},
        sortOrder: 60,
      },
      {
        measurementKey: "ARMHOLE",
        baseValue: 1000,
        gradeIncrement: 81,
        gradeOverrides: {"S":50,"M":75,"L":100,"XL":100},
        sortOrder: 70,
      },
      {
        measurementKey: "LENGTH",
        baseValue: 3700,
        gradeIncrement: 40,
        gradeOverrides: {"XS":0,"S":0,"M":100,"L":100,"XL":0},
        sortOrder: 80,
      },
      {
        measurementKey: "SWEEP",
        baseValue: 2350,
        gradeIncrement: 163,
        gradeOverrides: {"S":50,"M":150,"L":250,"XL":200},
        sortOrder: 90,
      }
    ],
  }
] as const;
