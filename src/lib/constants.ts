// Real farm/paddock codes, read off the latest wedge exports (per the
// handoff spec). Used only to seed the database on first setup — after
// that, farms/paddocks live in the DB and this file is not read at runtime.
export const FARM_DEFS = [
  {
    slug: "burnview",
    name: "Burnview",
    codes: [
      "09", "76", "51", "44", "18", "30", "73", "22", "37", "78", "77", "62", "20", "10", "52", "46", "28", "01", "31", "19",
      "24", "29", "12", "33", "13", "56", "74", "16", "67", "59", "21", "02", "49", "32", "65", "11", "04", "05", "41", "45",
      "61", "14", "15", "60", "17", "70", "48", "27", "47", "03", "25", "08", "63", "72", "07", "69", "81", "71", "36", "23",
      "66", "42", "39", "80", "54", "64", "38", "53", "75", "79", "55", "06", "40", "43", "57",
    ],
    // Known real replant dates (paddock -> ISO date, or null if the reason for
    // no data isn't recorded).
    replants: { "35": "2026-07-11", "50": null, "34": "2026-07-05", "68": "2026-07-02", "26": "2026-07-07" } as Record<string, string | null>,
  },
  {
    slug: "everfair",
    name: "Everfair",
    codes: [
      "E32", "E33", "E14", "E16", "E28", "E29", "E15", "E13", "E26", "E11", "E24", "E23", "E27", "E25", "E12",
      "E08", "E09", "E20", "E22", "E07", "E19", "E21", "E10", "E05", "E04", "E17", "E03", "E18", "E01", "E02",
    ],
    replants: { "E30": "2026-07-28", "E31": "2026-07-29", "E06": "2026-06-24" } as Record<string, string | null>,
  },
  {
    slug: "stockton",
    name: "Stockton",
    codes: [
      "S01", "S03", "S26", "S16", "S27", "S25", "S23", "S18", "S09", "S19", "S13", "S42", "S41", "S06", "S21",
      "S05", "S08", "S11", "S40", "S22", "S10", "S20", "S17", "S07", "S24", "S04", "S02", "S12", "S14",
    ],
    replants: { "S15": "2026-07-30" } as Record<string, string | null>,
  },
];

// Milking groups per farm — Burnview has 3, Everfair 1, Stockton 2.
export const CATTLE_GROUPS_BY_FARM_SLUG: Record<string, string[]> = {
  burnview: ["A", "B", "C"],
  everfair: ["EA"],
  stockton: ["SA", "SB"],
};

export const COLORS = {
  paper: "#EDEAD9",
  paperDeep: "#E2DEC8",
  ink: "#232A1E",
  inkSoft: "#5B6350",
  normal: "#3F6B3F",
  flagged: "#5C7C87",
  card: "#F6F4E9",
  mulch: "#8FA84E",
  grown: "#5C86A8",
  trend: "#232A1E",
};

// What can be planted. "High Velt Mix" is a sown seed blend (distinct from
// "High Velt" the land classification, which also covers naturally-occurring
// veld that was never planted at all). Chicory/clovers are usually a minor
// part of a rye grass mix, but get their own crop entry since they can be
// planted alone too.
export const CROP_TYPES = [
  "Rye grass", "Kikuyu", "Maize", "Oats", "Lucerne", "High Velt Mix",
  "Chicory", "Red clover", "White clover",
] as const;

// Land classification a paddock gets when a crop becomes its majority
// planting — every crop maps 1:1 except the seed blend, which becomes the
// "High Velt" land type like naturally-occurring veld does.
export const CROP_TO_LAND_TYPE: Record<string, string> = {
  "Rye grass": "Rye grass",
  "Kikuyu": "Kikuyu",
  "Maize": "Maize",
  "Oats": "Oats",
  "Lucerne": "Lucerne",
  "High Velt Mix": "High Velt",
  "Chicory": "Chicory",
  "Red clover": "Red clover",
  "White clover": "White clover",
};
export const LAND_TYPES = [
  "Rye grass", "Kikuyu", "Maize", "Oats", "Lucerne", "High Velt",
  "Chicory", "Red clover", "White clover", "Unplanted",
] as const;

// Maize is drilled by seed count, not weight — every other crop here is kg/ha.
export const CROP_UNITS: Record<string, string> = {
  "Rye grass": "kg/ha",
  "Kikuyu": "kg/ha",
  "Maize": "seeds/ha",
  "Oats": "kg/ha",
  "Lucerne": "kg/ha",
  "High Velt Mix": "kg/ha",
  "Chicory": "kg/ha",
  "Red clover": "kg/ha",
  "White clover": "kg/ha",
};

// Map fill colors on the farm map — John Deere green/black base, crop colors
// per Craig's own naming: rye = green, maize = orange, kikuyu = brown, high
// velt (natural grassland) = yellow. Unplanted/unclassified fall back to a
// neutral tone so they read as "no crop" rather than a fifth crop color.
export const LAND_TYPE_COLORS: Record<string, string> = {
  "Rye grass": "#173B0F",
  "Maize": "#B85A0A",
  "Kikuyu": "#8B5A2B",
  "High Velt": "#D9A916",
  "Oats": "#C9A227",
  "Lucerne": "#5B3A73",
  "Chicory": "#7A8B3F",
  "Red clover": "#8C2F39",
  "White clover": "#C9BFA0",
  "Unplanted": "#8C8477",
};
export const UNCLASSIFIED_COLOR = "#5B6350";

export const ACTIVITY_TYPES = [
  { id: "FERTILIZER", name: "Fertilizer" },
  { id: "MULCHING", name: "Mulching" },
  { id: "PLANTING", name: "Planting" },
  { id: "LAND_PREP", name: "Land prep" },
  { id: "SPRAYING", name: "Spraying" },
  { id: "MOWING", name: "Mowing for bailing" },
  { id: "BAILING", name: "Bailing" },
] as const;

export const BALE_TYPES = [
  "Rye Grass Rapped Bales",
  "Kikuyu Rapped Bales",
  "Foggage Kikuyu",
  "Velt Bales",
  "High Velt Bales",
];

// Rolling (post-planting) isn't tillage, unlike the other four — it's still
// logged under Land Prep but won't trigger auto-reclassification to "Unplanted".
export const LAND_PREP_METHODS = [
  { name: "Ripping", tillage: true },
  { name: "Disc", tillage: true },
  { name: "Speed Disc", tillage: true },
  { name: "Bomford", tillage: true },
  { name: "Rolling", tillage: false },
];

export const FERTILIZER_TYPES = [
  "Urea", "Potassium", "Phosphorus", "Chicken Litter", "Lime", "Cow Manure",
  "Slurry", "Compost", "LAN", "100(40%)+S", "Kynoplus Urea", "Kynoplus 100(40%)+S",
];

// GENERIC industry-typical N/P/K/S percentages — NOT Craig's actual product
// analysis. Seeded with isPlaceholder=true; editable from Settings > Fertilizer
// nutrients once real bag/spec-sheet numbers are available.
export const FERTILIZER_NUTRIENTS: Record<string, { N: number; P: number; K: number; S: number }> = {
  "Urea": { N: 46, P: 0, K: 0, S: 0 },
  "Potassium": { N: 0, P: 0, K: 50, S: 0 },
  "Phosphorus": { N: 0, P: 10.5, K: 0, S: 11 },
  "Chicken Litter": { N: 3, P: 2, K: 2, S: 0.5 },
  "Lime": { N: 0, P: 0, K: 0, S: 0 },
  "Cow Manure": { N: 0.5, P: 0.3, K: 0.5, S: 0.1 },
  "Slurry": { N: 0.3, P: 0.1, K: 0.3, S: 0.05 },
  "Compost": { N: 1, P: 0.5, K: 1, S: 0.2 },
  "LAN": { N: 28, P: 0, K: 0, S: 0 },
  "100(40%)+S": { N: 40, P: 0, K: 0, S: 6 },
  "Kynoplus Urea": { N: 46, P: 0, K: 0, S: 0 },
  "Kynoplus 100(40%)+S": { N: 40, P: 0, K: 0, S: 6 },
};

export const NUTRIENT_RANGES = [
  { id: "ytd", label: "YTD" },
  { id: "3m", label: "3 months" },
  { id: "6m", label: "6 months" },
  { id: "1y", label: "1 year" },
  { id: "all", label: "All time" },
] as const;

// Feed stock starts at 0 for every item — real opening balances need a
// restock entry once this is live.
export const FEED_ITEMS_SEED = [
  { name: "Silage", unit: "tons" },
  { name: "Dairy meal", unit: "tons" },
  { name: "Soya", unit: "tons" },
  { name: "Super 18", unit: "tons" },
  { name: "Supreme 20", unit: "tons" },
  ...BALE_TYPES.map((name) => ({ name, unit: "bales" })),
];

export const CHEMICAL_UNITS = ["L/ha", "mL/ha", "kg/ha", "g/ha"];

export const LAND_CATEGORIES = [
  { id: "fertilizer", name: "Fertilizer" },
  { id: "chemicals", name: "Chemicals" },
  { id: "seed", name: "Seed" },
];

export const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];
