export type BoundaryGeometry =
  | { type: "Polygon"; coordinates: [number, number][][] }
  | { type: "MultiPolygon"; coordinates: [number, number][][][] };

export type Paddock = {
  id: string;
  code: string;
  sizeHa: number | null;
  landType: string | null;
  boundary: BoundaryGeometry | null;
  maizeSortOrder: number | null;
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
  upcomingAllocation: boolean;
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

export type DiaryEntry = {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string;
  repeatDays: number | null;
  done: boolean;
  lastDoneAt: string | null;
  farmId: string | null;
  farm: { id: string; name: string } | null;
  createdAt: string;
};

export type Pivot = {
  id: string;
  farmId: string;
  farm: { id: string; name: string };
  name: string;
  paddockCodes: string[];
  mmAt100Pct: number | null;
  hoursAt100Pct: number | null;
  sortOrder: number;
};

export type IrrigationRun = {
  id: string;
  pivotId: string;
  date: string;
  percentage: number;
  startPaddockId: string | null;
  startPaddock: { id: string; code: string } | null;
  notes: string | null;
  createdAt: string;
};

export type IrrigationConflict = { paddockCode: string; groupName: string; date: string };

export type WaterMeter = {
  id: string;
  farmId: string;
  name: string;
  groupName: string;
  sortOrder: number;
};

export type WaterMeterReading = {
  id: string;
  meterId: string;
  date: string;
  reading: number;
  notes: string | null;
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
  brand: string | null;
  costPerBag: number | null;
  seedsPerBag: number | null;
  daysToMaturity: number | null;
  traitType: string | null;
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

export type FeedingTotals = {
  farms: {
    farmId: string;
    farmName: string;
    totalKgPerDay: number;
    groups: {
      groupId: string;
      groupName: string;
      currentCount: number | null;
      dairyMealKg: number | null;
      concentratesKg: number | null;
      kgPerCow: number | null;
      kgPerDay: number | null;
    }[];
  }[];
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
  section: "DAIRY" | "STAFF" | "TOGH" | "HAYDEN";
  name: string;
  employeeCode: string | null;
  role: string | null;
  notes: string | null;
  active: boolean;
  sortOrder: number;
};

export type TimeBookEntry = {
  id: string;
  workerId: string;
  date: string;
  code: "PRESENT" | "SICK" | "LEAVE" | "ABSENT" | "OFF" | "FAMILY_RESPONSIBILITY" | "INJURED_ON_DUTY" | null;
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
  workedFarm: string | null;
  filledAtFarm: string | null;
  eligible: boolean;
  secondReading: number | null;
  secondLitresFilled: number | null;
  secondFilledAtFarm: string | null;
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
  farmName?: string;
  paddockId: string;
  paddockCode?: string;
  varietyId: string | null;
  variety?: SeedVariety | null;
  phase: string | null;
  season: string;
  plannedAreaHa: number | null;
  population: number | null;
  notes: string | null;
  sortOrder: number;
  ordered: boolean;
};
