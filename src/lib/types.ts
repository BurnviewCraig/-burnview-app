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
  sprayPurpose: string | null;
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
  prevCover: number | null;
  wasDefoliated: boolean;
  hasData: boolean;
  growthPerDay: number | null;
  mulchDays: number | null;
  grazeDays: number | null;
  daysSinceDefoliation: number | null;
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

export type OrderNumber = {
  id: string;
  prefix: string;
  number: number;
  company: string | null;
  item: string | null;
  comment: string | null;
  farmId: string | null;
  farm: { id: string; name: string } | null;
  createdAt: string;
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
  costPerBag: number | null;
  seedsPerBag: number | null;
  daysToMaturity: number | null;
};

export type CattleGroup = {
  id: string;
  farmId: string;
  farmName?: string;
  name: string;
  currentCount: number | null;
  currentCountDate: string | null;
  currentMilkPerCow: number | null;
  currentMilkDate: string | null;
  previousMilkPerCow: number | null;
  currentDaysInMilk: number | null;
};

export type CattleCountEntry = {
  id: string;
  groupId: string;
  date: string;
  count: number;
};

export type MilkProductionEntry = {
  id: string;
  groupId: string;
  date: string;
  litresPerCow: number;
};

export type GroupWeightEntry = {
  id: string;
  groupId: string;
  date: string;
  avgWeightKg: number;
};

export type GroupDimEntry = {
  id: string;
  groupId: string;
  date: string;
  avgDaysInMilk: number;
};

export type GroupFeedEntry = {
  id: string;
  groupId: string;
  date: string;
  dairyMealKg: number | null;
  otherConcentrateName: string | null;
  otherConcentrateKg: number | null;
  silageKg: number | null;
};

export type AdditionalConcentrate = {
  id: string;
  groupId: string;
  name: string;
  kgPerCow: number;
  updatedAt: string;
};

export type CattleSummary = {
  current: {
    count: number | null;
    litresPerCow: number | null;
    avgWeightKg: number | null;
    dairyMealKg: number | null;
    gramsPerLitre: number | null;
    avgDaysInMilk: number | null;
  } | null;
  trend: {
    litres: { date: string; value: number }[];
    weight: { date: string; value: number }[];
    dairyMeal: { date: string; value: number }[];
    gramsPerLitre: { date: string; value: number }[];
    count: { date: string; value: number }[];
    daysInMilk: { date: string; value: number }[];
  };
};

export type MilkSaleEntry = {
  id: string;
  farmId: string;
  farmName?: string;
  date: string;
  litres: number;
  takenBy: string | null;
};

export type RainfallEntry = {
  id: string;
  farmId: string;
  date: string;
  mm: number;
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

export type DieselActivityType = {
  id: string;
  name: string;
  sortOrder: number;
};

export type DieselAsset = {
  id: string;
  farmId: string;
  name: string;
  numberPlate: string | null;
  unit: "HOURS" | "KM";
  active: boolean;
  sortOrder: number;
};

export type DieselLogEntry = {
  id: string;
  assetId: string;
  date: string;
  worked: boolean;
  openingReading: number | null;
  litresFilled: number | null;
  driverId: string | null;
  driver: { id: string; name: string } | null;
  activities: string[];
  paddockCodes: string[];
  comment: string | null;
  createdAt: string;
};

export type MaizeFieldSeason = {
  id: string;
  farmId: string;
  paddockId: string;
  paddockCode?: string;
  season: string;
  variety: string | null;
  varietyLength: string | null;
  plantDate: string | null;
  estMaturityDate: string | null;
  cutDate: string | null;
  population: number | null;
  yieldTonPerHa: number | null;
  burndownDate: string | null;
  preGerminationSprayDate: string | null;
  firstPostSprayDate: string | null;
  lastTractorEntryDate: string | null;
  firstTopDressingDate: string | null;
  secondTopDressingDate: string | null;
  silagePit: string | null;
  seedCostPerHa: number | null;
  notes: string | null;
  updatedAt: string;
};

export type MaizePlantingPlan = {
  id: string;
  farmId: string;
  season: string;
  plannedAreaHa: number | null;
  variety: string | null;
  notes: string | null;
};
