export type BoundaryGeometry =
  | { type: "Polygon"; coordinates: [number, number][][] }
  | { type: "MultiPolygon"; coordinates: [number, number][][][] };

export type Paddock = {
  id: string;
  code: string;
  sizeHa: number | null;
  landType: string | null;
  boundary: BoundaryGeometry | null;
};

export type Farm = {
  id: string;
  slug: string;
  name: string;
  paddocks: Paddock[];
};

export type FieldActivity = {
  id: string;
  farmId: string;
  paddockId: string;
  type: "FERTILIZER" | "MULCHING" | "PLANTING" | "LAND_PREP" | "SPRAYING" | "MOWING" | "BAILING";
  date: string;
  notes: string | null;
  product: string | null;
  rate: number | null;
  method: string | null;
  depth: number | null;
  mix: { crop: string; variety: string | null; rate: number; unit: string }[] | null;
  chemicals: { name: string; rate: number; unit: string }[] | null;
  bales: number | null;
  createdAt: string;
};

export type PastureWalk = {
  id: string;
  farmId: string;
  paddockId: string;
  date: string;
  cover: number;
};

export type WedgePaddock = {
  id: string;
  code: string;
  landType: string | null;
  sizeHa: number | null;
  cover: number | null;
  hasData: boolean;
  growthPerDay: number | null;
  mulchDays: number | null;
  walkDate: string | null;
  boundary: BoundaryGeometry | null;
};

export type WedgeFarm = {
  id: string;
  slug: string;
  name: string;
  paddockCount: number;
  noDataCount: number;
  avgCover: number | null;
  avgGrowth: number | null;
  paddocks: WedgePaddock[];
};

export type StockItem = {
  id: string;
  kind: "FEED" | "LAND_INPUT" | "DAIRY";
  category: string | null;
  name: string;
  unit: string;
  qty: number;
  farmId?: string | null;
};

export type FertilizerType = {
  id: string;
  name: string;
  nitrogenPct: number;
  phosphorusPct: number;
  potassiumPct: number;
  sulfurPct: number;
  isPlaceholder: boolean;
};

export type ChemicalType = {
  id: string;
  name: string;
  unit: string;
};

export type SeedVariety = {
  id: string;
  cropType: string;
  name: string;
};

export type CattleGroup = {
  id: string;
  farmId: string;
  name: string;
  currentCount: number | null;
  currentCountDate: string | null;
};

export type CattleCountEntry = {
  id: string;
  groupId: string;
  date: string;
  count: number;
};

export type GrazingAllocation = {
  id: string;
  groupId: string;
  farmId: string;
  paddockId: string;
  date: string;
  session: "DAY" | "NIGHT";
  notes: string | null;
  paddock: { code: string };
  group: { name: string };
  count?: number | null;
};

export type Worker = {
  id: string;
  farmId: string;
  section: "DAIRY" | "STAFF" | "TOGH";
  name: string;
  role: string | null;
  notes: string | null;
  active: boolean;
  sortOrder: number;
};

export type TimeBookEntry = {
  id: string;
  workerId: string;
  date: string;
  code: "PRESENT" | "SICK" | "LEAVE" | "ABSENT" | "OFF" | null;
  overtime: string | null;
};
