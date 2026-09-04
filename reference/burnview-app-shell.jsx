import React, { useState, useMemo } from "react";
import { Beef, Wheat, Map as MapIcon, ChevronLeft, X, Droplets, Milk, Sprout, ChevronRight, ClipboardList, Tractor, Leaf, Layers, SprayCan, Footprints, Boxes, Plus, Utensils, Pencil } from "lucide-react";
import { BarChart, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Cell, LabelList, ReferenceLine } from "recharts";

// Fixed "today" so days-since-mulched is deterministic in this mockup.
const TODAY = new Date("2026-09-01");

// ---------------------------------------------------------------------------
// Paddock codes and the farm-level summary figures are real, read off the
// latest feed wedge exports. "Cover" shown throughout = Wedge Cover, and
// "Growth" = Weighted Avg — both from each wedge's summary box. Individual
// per-paddock cover values below are still synthetic placeholders — swap
// for a real feed/wedge data feed once that's wired up.
// ---------------------------------------------------------------------------

const FARM_DEFS = [
  {
    id: "burnview",
    name: "Burnview",
    codes: ["09","76","51","44","18","30","73","22","37","78","77","62","20","10","52","46","28","01","31","19",
      "24","29","12","33","13","56","74","16","67","59","21","02","49","32","65","11","04","05","41","45",
      "61","14","15","60","17","70","48","27","47","03","25","08","63","72","07","69","81","71","36","23",
      "66","42","39","80","54","64","38","53","75","79","55","06","40","43","57"],
    flagged: { "35": "2026-07-11", "50": null, "34": "2026-07-05", "68": "2026-07-02", "26": "2026-07-07" },
    // from the latest wedge export's summary box
    actualCover: 1246, wedgeCover: 2502, weightedAvgGrowth: 66.5, dmProduced: 20247, avgResidual: 1890,
  },
  {
    id: "everfair",
    name: "Everfair",
    codes: ["E32","E33","E14","E16","E28","E29","E15","E13","E26","E11","E24","E23","E27","E25","E12",
      "E08","E09","E20","E22","E07","E19","E21","E10","E05","E04","E17","E03","E18","E01","E02"],
    flagged: { "E30": "2026-07-28", "E31": "2026-07-29", "E06": "2026-06-24" },
    actualCover: 482, wedgeCover: 2443, weightedAvgGrowth: 42.8, dmProduced: 5156, avgResidual: 1970,
  },
  {
    id: "stockton",
    name: "Stockton",
    codes: ["S01","S03","S26","S16","S27","S25","S23","S18","S09","S19","S13","S42","S41","S06","S21",
      "S05","S08","S11","S40","S22","S10","S20","S17","S07","S24","S04","S02","S12","S14"],
    flagged: { "S15": "2026-07-30" },
    actualCover: 543, wedgeCover: 2480, weightedAvgGrowth: 63.0, dmProduced: 8425, avgResidual: 1900,
  },
];

const COLORS = {
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

function buildFarm(def) {
  const all = [...def.codes];
  // interleave flagged codes back into a plausible position
  Object.keys(def.flagged).forEach((c, i) => all.splice(3 + i * 7, 0, c));
  const paddocks = all.map((code, idx) => {
    const isFlagged = Object.prototype.hasOwnProperty.call(def.flagged, code);
    return {
      code,
      farm: def.name,
      flagged: isFlagged,
      eventDate: isFlagged ? def.flagged[code] : null,
      cover: isFlagged ? null : 1780 + idx * 13 + (idx % 5) * 4,
    };
  });
  return { ...def, paddocks, flaggedCount: paddocks.filter((p) => p.flagged).length };
}

const FARMS = FARM_DEFS.map(buildFarm);

// paddock-count-weighted approximation for a combined figure — swap for an
// area-weighted calc once paddock hectares are in the data model.
const combinedCover = Math.round(
  FARMS.reduce((s, f) => s + f.wedgeCover * f.paddocks.length, 0) /
    FARMS.reduce((s, f) => s + f.paddocks.length, 0)
);
const combinedGrowth = (
  FARMS.reduce((s, f) => s + f.weightedAvgGrowth * f.paddocks.length, 0) /
  FARMS.reduce((s, f) => s + f.paddocks.length, 0)
).toFixed(1);

// Deterministic pseudo-random field layout — organic-looking paddock shapes
// tiled across a grid, since there's no real GPS boundary data yet. Swap for
// real KML/GeoJSON boundaries per paddock when that's available.
function seededRand(seed) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}
function buildFieldLayout(count) {
  const viewW = 900, viewH = 620;
  const cols = Math.max(1, Math.round(Math.sqrt(count * (viewW / viewH))));
  const rows = Math.ceil(count / cols);
  const cellW = viewW / cols;
  const cellH = viewH / rows;
  const pad = 0.09, jitter = 0.14;
  const fontSize = Math.max(6, Math.min(11, cellW / 6.5));
  const layouts = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const bx0 = col * cellW + cellW * pad, bx1 = (col + 1) * cellW - cellW * pad;
    const by0 = row * cellH + cellH * pad, by1 = (row + 1) * cellH - cellH * pad;
    const corners = [[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]];
    const jittered = corners.map(([x, y], ci) => [
      x + (seededRand(i * 4 + ci) - 0.5) * cellW * jitter,
      y + (seededRand(i * 4 + ci + 100) - 0.5) * cellH * jitter,
    ]);
    layouts.push({
      points: jittered.map((p) => p.join(",")).join(" "),
      cx: (bx0 + bx1) / 2, cy: (by0 + by1) / 2, fontSize,
    });
  }
  return layouts;
}

// Seeded activity history from the wedge data's known replant dates — the
// rest of a paddock's history accumulates as entries are logged in-app.
const seedLog = FARMS.flatMap((f) =>
  Object.entries(f.flagged)
    .filter(([, date]) => date)
    .map(([code, date]) => ({
      id: `${f.id}-${code}-seed`, farmId: f.id, farmName: f.name, paddock: code,
      type: "Planting", date, notes: "Replanted",
    }))
);

// Placeholder herd-in-paddock markers for the map — Cattle isn't built yet,
// so there's no real herd/group data. One illustrative assignment per farm
// so the map's cow marker + click-for-history behavior is visible; replace
// with real herd locations once Cattle exists.
const HERD_SEED = [
  { farmId: "burnview", paddock: "01", groupName: "Milking herd" },
  { farmId: "everfair", paddock: "E01", groupName: "Milking herd" },
  { farmId: "stockton", paddock: "S01", groupName: "Dry herd" },
];
function getHerd(farmId, code) {
  return HERD_SEED.find((h) => h.farmId === farmId && h.paddock === code) || null;
}

// Land-use categories per your description: ryegrass pasture, kikuyu
// pasture, and maize lands (some double-cropped with white oats, some
// under irrigation getting annual ryegrass). "Unplanted" is added
// automatically once a field is tilled — see auto-classification below.
const CROP_TYPES = ["Rye grass", "Kikuyu", "Maize"];
const LAND_TYPES = [...CROP_TYPES, "Unplanted"];
function landTypeKey(farmId, code) { return `${farmId}:${code}`; }

// Every paddock entered so far is an irrigated ryegrass camp, per Craig —
// defaults all of them to "Rye grass" rather than requiring per-paddock
// tagging. Retag individual paddocks (Kikuyu, Maize) from the map as needed.
const DEFAULT_LAND_TYPES = {};
FARMS.forEach((f) => f.paddocks.forEach((p) => { DEFAULT_LAND_TYPES[landTypeKey(f.id, p.code)] = "Rye grass"; }));

const ACTIVITY_TYPES = [
  { id: "fertilizer", name: "Fertilizer", icon: Sprout },
  { id: "mulching", name: "Mulching", icon: Layers },
  { id: "planting", name: "Planting", icon: Leaf },
  { id: "land-prep", name: "Land prep", icon: Tractor },
  { id: "spraying", name: "Spraying", icon: SprayCan },
];

// Rolling (post-planting) isn't tillage, unlike the other four — kept here
// for convenience since it's still logged under Land Prep, but it won't
// trigger the auto-reclassification to "Unplanted".
const LAND_PREP_METHODS = [
  { name: "Ripping", tillage: true },
  { name: "Disc", tillage: true },
  { name: "Speed Disc", tillage: true },
  { name: "Bomford", tillage: true },
  { name: "Rolling", tillage: false },
];

const FERTILIZER_TYPES = [
  "Urea", "Potassium", "Phosphorus", "Chicken Litter", "Lime", "Cow Manure",
  "Slurry", "Compost", "LAN", "100(40%)+S", "Kynoplus Urea", "Kynoplus 100(40%)+S",
];

// GENERIC industry-typical N/P/K/S percentages — NOT your actual product
// analysis. These are placeholders so the nutrient-history feature works;
// swap every value here for the real analysis off your bag labels / supplier
// spec sheets before trusting the totals for real decisions.
const FERTILIZER_NUTRIENTS = {
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

const NUTRIENT_RANGES = [
  { id: "ytd", label: "YTD" },
  { id: "3m", label: "3 months" },
  { id: "6m", label: "6 months" },
  { id: "1y", label: "1 year" },
  { id: "all", label: "All time" },
];
function withinRange(dateStr, rangeId) {
  const d = new Date(dateStr);
  if (rangeId === "all") return true;
  if (rangeId === "ytd") return d.getFullYear() === TODAY.getFullYear();
  const cutoff = new Date(TODAY);
  if (rangeId === "3m") cutoff.setMonth(cutoff.getMonth() - 3);
  if (rangeId === "6m") cutoff.setMonth(cutoff.getMonth() - 6);
  if (rangeId === "1y") cutoff.setFullYear(cutoff.getFullYear() - 1);
  return d >= cutoff;
}

// Feed stock starts at 0 for every item — real opening balances need a
// restock entry once this is live, rather than a guessed starting number.
const FEED_ITEMS_SEED = [
  { id: "silage", name: "Silage", unit: "tons", qty: 0 },
  { id: "bales", name: "Bales", unit: "bales", qty: 0 },
  { id: "dairy-meal", name: "Dairy meal", unit: "tons", qty: 0 },
  { id: "soya", name: "Soya", unit: "tons", qty: 0 },
  { id: "super-18", name: "Super 18", unit: "tons", qty: 0 },
  { id: "supreme-20", name: "Supreme 20", unit: "tons", qty: 0 },
];

const LAND_CATEGORIES = [
  { id: "fertilizer", name: "Fertilizer" },
  { id: "chemicals", name: "Chemicals" },
  { id: "seed", name: "Seed" },
];
const slugify = (s) => s.toLowerCase().trim().replace(/\s+/g, "-");

// Weekly pasture-walk cover readings, keyed loosely like the activity log.
// The most recent reading per paddock overrides the synthetic placeholder
// cover everywhere else in the app (wedge chart, field history).
function getLatestWalk(walkLog, farmId, code) {
  const entries = walkLog.filter((w) => w.farmId === farmId && w.paddock === code);
  if (!entries.length) return null;
  return entries.reduce((a, b) => (a.date > b.date ? a : b));
}

// "1 to the end" order for a pasture walk — numeric, ignoring any letter prefix.
function byPaddockNumber(a, b) {
  const na = parseInt(a.code.replace(/\D/g, ""), 10);
  const nb = parseInt(b.code.replace(/\D/g, ""), 10);
  return na - nb;
}

const baseStyle = `
  font-family: 'Space Grotesk', 'Inter', ui-sans-serif, system-ui, sans-serif;
  --paper: ${COLORS.paper}; --paper-deep: ${COLORS.paperDeep}; --ink: ${COLORS.ink};
  --ink-soft: ${COLORS.inkSoft}; --normal: ${COLORS.normal}; --flagged: ${COLORS.flagged}; --card: ${COLORS.card};
`;

function Header({ title, onBack, action }) {
  return (
    <div className="hdr">
      {onBack ? (
        <button className="back" onClick={onBack}><ChevronLeft size={18} /></button>
      ) : (
        <Milk size={20} strokeWidth={1.75} />
      )}
      <h1>{title}</h1>
      {action && <div className="hdr-action-slot">{action}</div>}
    </div>
  );
}

function HomeScreen({ go }) {
  return (
    <div className="screen home">
      <div className="brand"><Milk size={22} strokeWidth={1.75} /><span>Burnview Group</span></div>
      <div className="home-cards">
        <button className="home-card" onClick={() => go("farm")}>
          <MapIcon size={30} strokeWidth={1.5} />
          <span className="hc-title">Farm</span>
          <span className="hc-sub">Map &amp; field activities</span>
        </button>
        <button className="home-card" onClick={() => go("cattle")}>
          <Beef size={30} strokeWidth={1.5} />
          <span className="hc-title">Cattle</span>
          <span className="hc-sub">Herds &amp; movements</span>
        </button>
        <button className="home-card" onClick={() => go("food")}>
          <Wheat size={30} strokeWidth={1.5} />
          <span className="hc-title">Food</span>
          <span className="hc-sub">Pastures &amp; feed</span>
        </button>
        <button className="home-card" onClick={() => go("stocks")}>
          <Boxes size={30} strokeWidth={1.5} />
          <span className="hc-title">Stocks</span>
          <span className="hc-sub">Fertilizer, diesel &amp; inputs</span>
        </button>
        <button className="home-card" onClick={() => go("feeding")}>
          <Utensils size={30} strokeWidth={1.5} />
          <span className="hc-title">Feeding</span>
          <span className="hc-sub">Log what's fed — draws from Feed stock</span>
        </button>
      </div>
    </div>
  );
}

function CattleScreen({ go }) {
  return (
    <div className="screen">
      <Header title="Cattle" onBack={() => go("home")} />
      <div className="empty">
        <Beef size={26} strokeWidth={1.5} />
        <p>Herd tracking isn't built yet — this is next after the feed side.</p>
      </div>
    </div>
  );
}

function FeedingScreen({ go }) {
  return (
    <div className="screen">
      <Header title="Feeding" onBack={() => go("home")} />
      <div className="empty">
        <Utensils size={26} strokeWidth={1.5} />
        <p>Feeding isn't built yet. Once it is, what's logged here will draw down the matching item in Stocks — it'll just live as its own section, not inside Stocks itself.</p>
      </div>
    </div>
  );
}

function StocksScreen({ go }) {
  return (
    <div className="screen">
      <Header title="Stocks" onBack={() => go("home")} />
      <div className="menu-list">
        <button className="menu-row" onClick={() => go("feed-stock")}>
          <Wheat size={18} strokeWidth={1.75} />
          <div className="menu-row-text"><span className="mr-title">Feed</span><span className="mr-sub">Silage, bales, dairy meal, commodities</span></div>
          <ChevronRight size={16} />
        </button>
        <button className="menu-row" onClick={() => go("land-stock")}>
          <Boxes size={18} strokeWidth={1.75} />
          <div className="menu-row-text"><span className="mr-title">Land inputs</span><span className="mr-sub">Fertilizer, chemicals, seed</span></div>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// Shared bottom panel for both feed and land stock movements — "Use" draws
// down the balance, "Restock" adds to it. Reuses the pasture-walk keypad look.
function StockEntryPanel({ item, farms, showPaddock, onClose, onSave }) {
  const todayStr = TODAY.toISOString().slice(0, 10);
  const [mode, setMode] = useState("use");
  const [farmId, setFarmId] = useState(farms[0]?.id || "");
  const [paddock, setPaddock] = useState("");
  const [qty, setQty] = useState("");
  const [date, setDate] = useState(todayStr);

  const farm = farms.find((f) => f.id === farmId);
  const canSave = qty !== "" && Number(qty) > 0 && date && farmId;

  const handleKey = (k) => {
    setQty((prev) => {
      if (k === "C") return "";
      if (k === "⌫") return prev.slice(0, -1);
      return (prev + k).slice(0, 6);
    });
  };

  const handleSave = () => {
    onSave({ itemId: item.id, itemName: item.name, unit: item.unit, mode, qty: Number(qty), date, farmId, paddock: showPaddock ? paddock : null });
  };

  return (
    <div className="keypad-panel stock-panel">
      <div className="keypad-header">
        <div className="stock-panel-title">
          <span className="keypad-code">{item.name}</span>
          <span className="stock-panel-qty">{item.qty} {item.unit} in stock</span>
        </div>
        <X size={18} className="close" onClick={onClose} />
      </div>

      <div className="mode-toggle">
        <button className={`mode-btn${mode === "use" ? " active" : ""}`} onClick={() => setMode("use")}>Use</button>
        <button className={`mode-btn${mode === "restock" ? " active" : ""}`} onClick={() => setMode("restock")}>Restock</button>
      </div>

      <div className="stock-panel-fields">
        <select className="field-input small" value={farmId} onChange={(e) => { setFarmId(e.target.value); setPaddock(""); }}>
          {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        {showPaddock && mode === "use" && farm && (
          <select className="field-input small" value={paddock} onChange={(e) => setPaddock(e.target.value)}>
            <option value="">No specific paddock</option>
            {[...farm.paddocks].sort(byPaddockNumber).map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}
          </select>
        )}
        <input className="field-input small" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="keypad-value-row">{qty || "0"} <span className="keypad-unit">{item.unit}</span></div>
      <div className="keypad-grid">
        {KEYPAD_KEYS.map((k) => (
          <button key={k} className={`keypad-key${k === "C" || k === "⌫" ? " keypad-key-alt" : ""}`} onClick={() => handleKey(k)}>{k}</button>
        ))}
      </div>
      <button className="save-btn keypad-next" onClick={handleSave} disabled={!canSave}>
        {mode === "use" ? "Log usage" : "Log restock"}
      </button>
    </div>
  );
}

function FeedStockScreen({ go, feedStock, applyFeedEntry, addFeedItem, title = "Feed stock", backTo = "stocks" }) {
  const [activeItemId, setActiveItemId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("tons");

  const activeItem = feedStock.find((i) => i.id === activeItemId);

  const handleAdd = () => {
    if (!newName.trim()) return;
    addFeedItem(newName.trim(), newUnit);
    setNewName("");
    setAdding(false);
  };

  return (
    <div className="screen">
      <Header
        title={title}
        onBack={() => go(backTo)}
        action={<button className="hdr-action" onClick={() => setAdding((a) => !a)}><Plus size={14} strokeWidth={2} />Add item</button>}
      />

      {adding && (
        <div className="add-item-bar">
          <input className="field-input small" placeholder="Item name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <select className="field-input small" value={newUnit} onChange={(e) => setNewUnit(e.target.value)}>
            <option value="tons">tons</option>
            <option value="bags">bags</option>
            <option value="bales">bales</option>
            <option value="litres">litres</option>
          </select>
          <button className="save-btn small" onClick={handleAdd}>Add</button>
        </div>
      )}

      <div className="stock-list" style={{ paddingBottom: activeItem ? 260 : 0 }}>
        {feedStock.map((item) => (
          <button key={item.id} className={`stock-row${activeItemId === item.id ? " active" : ""}`} onClick={() => setActiveItemId(item.id)}>
            <span className="stock-row-name">{item.name}</span>
            <span className={`stock-row-qty${item.qty === 0 ? " zero" : ""}`}>{item.qty} {item.unit}</span>
          </button>
        ))}
      </div>

      {activeItem && (
        <StockEntryPanel
          item={activeItem}
          farms={FARMS}
          showPaddock={false}
          onClose={() => setActiveItemId(null)}
          onSave={(entry) => { applyFeedEntry(entry); setActiveItemId(null); }}
        />
      )}
    </div>
  );
}

function LandStockScreen({ go, landStock, applyLandEntry, addLandItem }) {
  const [category, setCategory] = useState("fertilizer");
  const [activeItemId, setActiveItemId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("bags");

  const catName = LAND_CATEGORIES.find((c) => c.id === category).name;
  const items = landStock.filter((i) => i.category === category);
  const activeItem = items.find((i) => i.id === activeItemId);

  const switchCat = (c) => { setCategory(c); setActiveItemId(null); setAdding(false); };

  const handleAdd = () => {
    if (!newName.trim()) return;
    addLandItem(category, newName.trim(), newUnit);
    setNewName("");
    setAdding(false);
  };

  return (
    <div className="screen">
      <Header
        title="Land inputs"
        onBack={() => go("stocks")}
        action={<button className="hdr-action" onClick={() => setAdding((a) => !a)}><Plus size={14} strokeWidth={2} />Add item</button>}
      />

      <div className="tabs">
        {LAND_CATEGORIES.map((c) => (
          <button key={c.id} className={`tab${category === c.id ? " active" : ""}`} onClick={() => switchCat(c.id)}>{c.name}</button>
        ))}
      </div>

      {adding && (
        <div className="add-item-bar">
          <input className="field-input small" placeholder={`${catName} name`} value={newName} onChange={(e) => setNewName(e.target.value)} />
          <select className="field-input small" value={newUnit} onChange={(e) => setNewUnit(e.target.value)}>
            <option value="bags">bags</option>
            <option value="tons">tons</option>
            <option value="litres">litres</option>
            <option value="kg">kg</option>
          </select>
          <button className="save-btn small" onClick={handleAdd}>Add</button>
        </div>
      )}

      <div className="stock-list" style={{ paddingBottom: activeItem ? 300 : 0 }}>
        {items.length === 0 && (
          <div className="empty">
            <Boxes size={22} strokeWidth={1.5} />
            <p>No {catName.toLowerCase()} tracked yet — add one above.</p>
          </div>
        )}
        {items.map((item) => (
          <button key={item.id} className={`stock-row${activeItemId === item.id ? " active" : ""}`} onClick={() => setActiveItemId(item.id)}>
            <span className="stock-row-name">{item.name}</span>
            <span className={`stock-row-qty${item.qty === 0 ? " zero" : ""}`}>{item.qty} {item.unit}</span>
          </button>
        ))}
      </div>

      {activeItem && (
        <StockEntryPanel
          item={activeItem}
          farms={FARMS}
          showPaddock={true}
          onClose={() => setActiveItemId(null)}
          onSave={(entry) => { applyLandEntry({ ...entry, category }); setActiveItemId(null); }}
        />
      )}
    </div>
  );
}

function FarmScreen({ go }) {
  return (
    <div className="screen">
      <Header title="Farm" onBack={() => go("home")} />
      <div className="menu-list">
        <button className="menu-row" onClick={() => go("map")}>
          <MapIcon size={18} strokeWidth={1.75} />
          <div className="menu-row-text"><span className="mr-title">Map</span><span className="mr-sub">All 3 farms — herds &amp; field history</span></div>
          <ChevronRight size={16} />
        </button>
        <button className="menu-row" onClick={() => go("activities")}>
          <ClipboardList size={18} strokeWidth={1.75} />
          <div className="menu-row-text"><span className="mr-title">Field activities</span><span className="mr-sub">Fertilizer, mulching, planting, land prep, spraying</span></div>
          <ChevronRight size={16} />
        </button>
        <button className="menu-row" onClick={() => go("field-editor")}>
          <Pencil size={18} strokeWidth={1.75} />
          <div className="menu-row-text"><span className="mr-title">Edit fields</span><span className="mr-sub">Size &amp; classification per paddock</span></div>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function FieldEditorScreen({ go, fieldMeta, setFieldMeta, landTypeMap, setLandType }) {
  const [farmId, setFarmId] = useState(FARMS[0].id);
  const [activeCode, setActiveCode] = useState(null);
  const [area, setArea] = useState("");

  const farm = FARMS.find((f) => f.id === farmId);
  const orderedPaddocks = useMemo(() => [...farm.paddocks].sort(byPaddockNumber), [farm]);
  const classification = activeCode ? (landTypeMap[landTypeKey(farmId, activeCode)] || null) : null;

  const switchFarm = (id) => { setFarmId(id); setActiveCode(null); };

  const openField = (code) => {
    setActiveCode(code);
    const m = fieldMeta[landTypeKey(farmId, code)] || {};
    setArea(m.area != null ? String(m.area) : "");
  };

  const handleDone = () => {
    setFieldMeta(farmId, activeCode, { area: area !== "" ? Number(area) : null });
    setActiveCode(null);
  };

  return (
    <div className="screen">
      <Header title="Edit fields" onBack={() => go("farm")} />

      <div className="tabs">
        {FARMS.map((f) => (
          <button key={f.id} className={`tab${farmId === f.id ? " active" : ""}`} onClick={() => switchFarm(f.id)}>{f.name}</button>
        ))}
      </div>

      <div className="walk-list" style={{ paddingBottom: activeCode ? 260 : 0 }}>
        {orderedPaddocks.map((p) => {
          const m = fieldMeta[landTypeKey(farmId, p.code)] || {};
          const cls = landTypeMap[landTypeKey(farmId, p.code)] || "Unclassified";
          return (
            <button key={p.code} className={`walk-row${activeCode === p.code ? " active" : ""}`} onClick={() => openField(p.code)}>
              <span className="wr-code">{p.code}</span>
              <span className="field-editor-sub">{m.area ? `${m.area} ha` : "No size set"} · {cls}</span>
            </button>
          );
        })}
      </div>

      {activeCode && (
        <div className="keypad-panel">
          <div className="keypad-header">
            <div className="stock-panel-title">
              <span className="keypad-code">{farm.name} — {activeCode}</span>
              <span className="stock-panel-qty">Currently: {classification || "Unclassified"}</span>
            </div>
            <X size={18} className="close" onClick={() => setActiveCode(null)} />
          </div>

          <label className="field">
            <span className="field-label">Size (ha)</span>
            <input className="field-input small" type="number" inputMode="decimal" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. 8.2" />
          </label>

          <div className="field" style={{ marginTop: 10 }}>
            <span className="field-label">Classification</span>
            <div className="chip-wrap">
              {LAND_TYPES.map((t) => (
                <button
                  key={t}
                  className={`range-chip${classification === t ? " on" : ""}`}
                  onClick={() => setLandType(farmId, activeCode, classification === t ? null : t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <button className="save-btn keypad-next" onClick={handleDone} style={{ marginTop: 14 }}>Done</button>
        </div>
      )}
    </div>
  );
}

function FoodScreen({ go }) {
  return (
    <div className="screen">
      <Header title="Food" onBack={() => go("home")} />
      <div className="menu-list">
        <button className="menu-row" onClick={() => go("wedge")}>
          <Layers size={18} strokeWidth={1.75} />
          <div className="menu-row-text"><span className="mr-title">Farm wedge</span><span className="mr-sub">Cover &amp; growth by paddock</span></div>
          <ChevronRight size={16} />
        </button>
        <div className="menu-row disabled">
          <Wheat size={18} strokeWidth={1.75} />
          <div className="menu-row-text"><span className="mr-title">Feed budget</span><span className="mr-sub">Coming soon</span></div>
        </div>
      </div>
    </div>
  );
}

function ActivitiesScreen({ go, setActivityType }) {
  return (
    <div className="screen">
      <Header title="Field activities" onBack={() => go("farm")} />
      <div className="menu-list">
        {ACTIVITY_TYPES.map((a) => {
          const Icon = a.icon;
          return (
            <button key={a.id} className="menu-row" onClick={() => { setActivityType(a); go("activity-form"); }}>
              <Icon size={18} strokeWidth={1.75} />
              <div className="menu-row-text"><span className="mr-title">{a.name}</span><span className="mr-sub">Log a {a.name.toLowerCase()} event</span></div>
              <ChevronRight size={16} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActivityFormScreen({ go, activityType, addLogEntry, setLandType }) {
  const todayStr = TODAY.toISOString().slice(0, 10);
  const [farmId, setFarmId] = useState(FARMS[0].id);
  const [selected, setSelected] = useState([]);
  const [fertType, setFertType] = useState("");
  const [rate, setRate] = useState("");
  const [prepMethod, setPrepMethod] = useState("");
  const [depth, setDepth] = useState("");
  const [mix, setMix] = useState({ "Rye grass": "", "Kikuyu": "", "Maize": "" });
  const [date, setDate] = useState(todayStr);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(null);

  const isFertilizer = activityType?.id === "fertilizer";
  const isLandPrep = activityType?.id === "land-prep";
  const isPlanting = activityType?.id === "planting";
  const farm = FARMS.find((f) => f.id === farmId);
  const orderedPaddocks = useMemo(() => [...farm.paddocks].sort(byPaddockNumber), [farm]);
  const selectedMethod = LAND_PREP_METHODS.find((m) => m.name === prepMethod) || null;
  const isTillage = selectedMethod ? selectedMethod.tillage : false;

  const switchFarm = (id) => { setFarmId(id); setSelected([]); setSaved(null); };
  const togglePaddock = (code) => setSelected((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);
  const selectAll = () => setSelected(orderedPaddocks.map((p) => p.code));
  const clearAll = () => setSelected([]);

  // Majority component of the seed mix decides the field's new classification.
  const majorityCrop = useMemo(() => {
    const entries = CROP_TYPES.map((c) => [c, Number(mix[c]) || 0]).filter(([, v]) => v > 0);
    if (!entries.length) return null;
    return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  }, [mix]);
  const mixTotal = CROP_TYPES.reduce((s, c) => s + (Number(mix[c]) || 0), 0);

  const handleSave = () => {
    selected.forEach((code) => {
      addLogEntry({
        id: `${farmId}-${code}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        farmId, farmName: farm.name, paddock: code,
        type: activityType ? activityType.name : "Activity",
        product: isFertilizer ? fertType : null,
        rate: isFertilizer ? Number(rate) : null,
        method: isLandPrep ? prepMethod : null,
        depth: isLandPrep && depth ? Number(depth) : null,
        mix: isPlanting ? CROP_TYPES.filter((c) => Number(mix[c]) > 0).map((c) => `${mix[c]}kg ${c}`).join(", ") : null,
        date, notes,
      });
      if (isLandPrep && isTillage) setLandType(farmId, code, "Unplanted");
      if (isPlanting && majorityCrop) setLandType(farmId, code, majorityCrop);
    });
    setSaved(selected.length);
    setSelected([]);
  };

  return (
    <div className="screen">
      <Header title={activityType ? `Log ${activityType.name.toLowerCase()}` : "Log activity"} onBack={() => go("activities")} />

      <div className="activity-scroll">
        <div className="form" style={{ paddingBottom: 8 }}>
          <label className="field">
            <span className="field-label">Farm</span>
            <select className="field-input" value={farmId} onChange={(e) => switchFarm(e.target.value)}>
              {FARMS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>

          {isFertilizer && (
            <div className="field">
              <span className="field-label">Fertilizer type{fertType ? ` — ${fertType}` : ""}</span>
              <div className="chip-wrap">
                {FERTILIZER_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`paddock-chip fert-chip${fertType === t ? " on" : ""}`}
                    onClick={() => setFertType(fertType === t ? "" : t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isFertilizer && (
            <label className="field">
              <span className="field-label">Rate (kg/ha)</span>
              <input className="field-input" type="number" inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 150" />
            </label>
          )}

          {isLandPrep && (
            <div className="field">
              <span className="field-label">Method{prepMethod ? ` — ${prepMethod}` : ""}</span>
              <div className="chip-wrap">
                {LAND_PREP_METHODS.map((m) => (
                  <button
                    key={m.name}
                    type="button"
                    className={`paddock-chip fert-chip${prepMethod === m.name ? " on" : ""}`}
                    onClick={() => setPrepMethod(prepMethod === m.name ? "" : m.name)}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
              <p className="field-hint">
                {selectedMethod
                  ? (isTillage
                      ? `${selectedMethod.name} is tillage — the selected paddocks will move to "Unplanted".`
                      : `${selectedMethod.name} isn't tillage — classification won't change.`)
                  : "Ripping, Disc, Speed Disc and Bomford are tillage and move fields to \"Unplanted\". Rolling doesn't."}
              </p>
            </div>
          )}

          {isLandPrep && (
            <label className="field">
              <span className="field-label">Depth (cm)</span>
              <input className="field-input" type="number" inputMode="numeric" value={depth} onChange={(e) => setDepth(e.target.value)} placeholder="e.g. 15" />
            </label>
          )}

          {isPlanting && (
            <div className="field">
              <span className="field-label">Seed mix (kg/ha){majorityCrop ? ` — classifies as ${majorityCrop}` : ""}</span>
              <div className="mix-rows">
                {CROP_TYPES.map((c) => (
                  <label key={c} className="mix-row">
                    <span>{c}</span>
                    <input
                      className="field-input small"
                      type="number"
                      inputMode="numeric"
                      value={mix[c]}
                      onChange={(e) => setMix((prev) => ({ ...prev, [c]: e.target.value }))}
                      placeholder="0"
                    />
                  </label>
                ))}
              </div>
              <p className="field-hint">Whichever component is the majority by weight sets the paddock's new classification.</p>
            </div>
          )}

          <label className="field">
            <span className="field-label">Date</span>
            <input className="field-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Notes</span>
            <textarea className="field-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Rate, contractor, anything worth noting" />
          </label>
        </div>

        <div className="paddock-picker-head">
          <span className="field-label">Paddocks ({selected.length} selected)</span>
          <div className="paddock-picker-actions">
            <button className="link-btn" onClick={selectAll}>Select all</button>
            <button className="link-btn" onClick={clearAll}>Clear</button>
          </div>
        </div>
        <div className="paddock-picker-list">
          {orderedPaddocks.map((p) => {
            const on = selected.includes(p.code);
            return (
              <button key={p.code} className={`paddock-chip${on ? " on" : ""}`} onClick={() => togglePaddock(p.code)}>
                <span className="paddock-chip-check">{on ? "✓" : ""}</span>
                {p.code}
              </button>
            );
          })}
        </div>
      </div>

      <div className="walk-save-bar">
        <button
          className="save-btn"
          onClick={handleSave}
          disabled={
            selected.length === 0 || !date ||
            (isFertilizer && (!fertType || !rate || Number(rate) <= 0)) ||
            (isLandPrep && !prepMethod) ||
            (isPlanting && mixTotal <= 0)
          }
        >
          Save entry ({selected.length})
        </button>
        {saved != null && (
          <p className="save-note">Logged {saved} paddock{saved === 1 ? "" : "s"} — you'll see this in each field's history on the farm map. Nothing persists once you close this though, until we wire up a real data layer.</p>
        )}
      </div>
    </div>
  );
}

function DataEntryScreen({ go }) {
  return (
    <div className="screen">
      <Header title="Data entry" onBack={() => go("wedge")} />
      <div className="menu-list">
        <button className="menu-row" onClick={() => go("pasture-walk")}>
          <Footprints size={18} strokeWidth={1.75} />
          <div className="menu-row-text"><span className="mr-title">Pasture walk</span><span className="mr-sub">Weekly cover reading — feeds the wedge</span></div>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

const KEYPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];

function PastureWalkScreen({ go, walkLog, addWalkEntries }) {
  const todayStr = TODAY.toISOString().slice(0, 10);
  const [farmId, setFarmId] = useState(FARMS[0].id);
  const [date, setDate] = useState(todayStr);
  const [readings, setReadings] = useState({});
  const [activeCode, setActiveCode] = useState(null);
  const [savedCount, setSavedCount] = useState(null);

  const farm = FARMS.find((f) => f.id === farmId);
  const orderedPaddocks = useMemo(() => [...farm.paddocks].sort(byPaddockNumber), [farm]);
  const filledCount = Object.values(readings).filter((v) => v !== "").length;

  const resetEntry = () => { setReadings({}); setActiveCode(null); setSavedCount(null); };
  const switchFarm = (id) => { setFarmId(id); resetEntry(); };

  const handleKey = (k) => {
    if (!activeCode) return;
    setReadings((prev) => {
      const cur = prev[activeCode] ?? "";
      let next = cur;
      if (k === "C") next = "";
      else if (k === "⌫") next = cur.slice(0, -1);
      else next = (cur + k).slice(0, 5);
      return { ...prev, [activeCode]: next };
    });
  };

  const handleNext = () => {
    const idx = orderedPaddocks.findIndex((p) => p.code === activeCode);
    const nextPaddock = orderedPaddocks[idx + 1];
    setActiveCode(nextPaddock ? nextPaddock.code : null);
  };

  const handleSave = () => {
    const entries = Object.entries(readings)
      .filter(([, v]) => v !== "" && Number(v) > 0)
      .map(([code, v]) => ({
        id: `${farmId}-${code}-${date}-${Date.now()}`,
        farmId, paddock: code, date, cover: Number(v),
      }));
    addWalkEntries(entries);
    setSavedCount(entries.length);
    setReadings({});
    setActiveCode(null);
  };

  const handleCancel = () => {
    resetEntry();
    setDate(todayStr);
  };

  return (
    <div className="screen">
      <Header title="Pasture walk" onBack={() => go("data-entry")} />

      <div className="tabs">
        {FARMS.map((f) => (
          <button key={f.id} className={`tab${farmId === f.id ? " active" : ""}`} onClick={() => switchFarm(f.id)}>{f.name}</button>
        ))}
      </div>

      <div className="walk-datebar">
        <label className="field" style={{ flex: 1 }}>
          <span className="field-label">Walk date</span>
          <input className="field-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="walk-progress">{filledCount} / {farm.paddocks.length} entered</div>
      </div>

      <div className="walk-list" style={{ paddingBottom: activeCode ? 232 : 0 }}>
        {orderedPaddocks.map((p) => {
          const val = readings[p.code] ?? "";
          return (
            <button
              key={p.code}
              className={`walk-row${activeCode === p.code ? " active" : ""}`}
              onClick={() => setActiveCode(p.code)}
            >
              <span className="wr-code">{p.code}</span>
              <span className={`wr-value${val === "" ? " placeholder" : ""}`}>{val !== "" ? val : "0"}</span>
              <span className="wr-unit">kg DM/ha</span>
            </button>
          );
        })}
      </div>

      {activeCode ? (
        <div className="keypad-panel">
          <div className="keypad-header">
            <span className="keypad-code">{activeCode}</span>
            <span className="keypad-value">{readings[activeCode] || "0"} <span className="keypad-unit">kg DM/ha</span></span>
            <X size={18} className="close" onClick={() => setActiveCode(null)} />
          </div>
          <div className="keypad-grid">
            {KEYPAD_KEYS.map((k) => (
              <button key={k} className={`keypad-key${k === "C" || k === "⌫" ? " keypad-key-alt" : ""}`} onClick={() => handleKey(k)}>{k}</button>
            ))}
          </div>
          <button className="save-btn keypad-next" onClick={handleNext}>Next field ▸</button>
        </div>
      ) : (
        <div className="walk-save-bar">
          <div className="walk-save-row">
            <button className="cancel-btn" onClick={handleCancel} disabled={filledCount === 0}>Cancel walk</button>
            <button className="save-btn" onClick={handleSave} disabled={filledCount === 0 || !date}>
              Save walk ({filledCount})
            </button>
          </div>
          {savedCount != null && (
            <p className="save-note">Saved {savedCount} readings for {farm.name} — {date}. These now feed the wedge and that field's history.</p>
          )}
        </div>
      )}
    </div>
  );
}

function FarmWedgeScreen({ go, log, walkLog }) {
  const [activeFarm, setActiveFarm] = useState("all");
  const [selected, setSelected] = useState(null);

  const totalPaddocks = FARMS.reduce((s, f) => s + f.paddocks.length, 0);
  const totalFlagged = FARMS.reduce((s, f) => s + f.flaggedCount, 0);

  const current = FARMS.find((f) => f.id === activeFarm) || null;

  // Sorted ascending by cover — tallest grass on the right, like the real
  // wedge exports. Flagged/no-data paddocks can't be height-sorted, so they
  // sit at the left edge (matches how the source wedges treat them).
  // "grown" (projected growth to the wedge target) and the trend line are
  // both synthetic, styled to echo the two-tone bar + trend line in the
  // real exports — swap for real wedge-target data once that's available.
  const sorted = useMemo(() => {
    if (!current) return [];
    // A real pasture-walk reading always overrides the synthetic placeholder
    // cover, and clears the "flagged / no data" status for that paddock.
    const effective = current.paddocks.map((p) => {
      const walk = getLatestWalk(walkLog, current.id, p.code);
      return walk ? { ...p, cover: walk.cover, flagged: false } : p;
    });
    const withCover = effective.filter((p) => !p.flagged).sort((a, b) => a.cover - b.cover);
    const flaggedPaddocks = effective.filter((p) => p.flagged);
    const combined = [...flaggedPaddocks, ...withCover];

    const covPoints = combined
      .map((p, i) => ({ x: i, y: p.cover }))
      .filter((pt) => pt.y != null);
    const n = covPoints.length;
    const sumX = covPoints.reduce((s, p) => s + p.x, 0);
    const sumY = covPoints.reduce((s, p) => s + p.y, 0);
    const sumXY = covPoints.reduce((s, p) => s + p.x * p.y, 0);
    const sumXX = covPoints.reduce((s, p) => s + p.x * p.x, 0);
    const denom = n * sumXX - sumX * sumX || 1;
    const slope = (n * sumXY - sumX * sumY) / denom;
    const intercept = (sumY - slope * sumX) / n;

    return combined.map((p, i) => {
      const mulchEntries = log.filter((l) => l.farmId === current.id && l.paddock === p.code && l.type === "Mulching");
      let mulchDays = null;
      if (mulchEntries.length) {
        const latest = mulchEntries.reduce((a, b) => (a.date > b.date ? a : b));
        mulchDays = Math.round((TODAY - new Date(latest.date)) / 86400000);
      }
      const grown = p.flagged ? null : Math.round(p.cover * 0.22);
      const trend = Math.max(0, Math.round(intercept + slope * i));
      return { ...p, mulchDays, grown, trend };
    });
  }, [current, log, walkLog]);

  const avgMulch = useMemo(() => {
    const withMulch = sorted.filter((p) => p.mulchDays != null);
    if (!withMulch.length) return null;
    return Math.round(withMulch.reduce((s, p) => s + p.mulchDays, 0) / withMulch.length);
  }, [sorted]);

  const TopLabel = (props) => {
    const { x, y, width, index } = props;
    const item = sorted[index];
    if (!item || item.flagged) return null;
    return (
      <text x={x + width / 2} y={y - 3} textAnchor="middle" fontSize={7} fill={COLORS.ink}>
        {item.cover + item.grown}
      </text>
    );
  };

  const chartWidth = current ? Math.max(420, sorted.length * 13) : 420;

  return (
    <div className="screen">
      <Header
        title="Farm wedge"
        onBack={() => go("food")}
        action={
          <button className="hdr-action" onClick={() => go("data-entry")}>
            <Footprints size={14} strokeWidth={2} />Data entry
          </button>
        }
      />

      <div className="tabs">
        <button className={`tab${activeFarm === "all" ? " active" : ""}`} onClick={() => { setActiveFarm("all"); setSelected(null); }}>All farms</button>
        {FARMS.map((f) => (
          <button key={f.id} className={`tab${activeFarm === f.id ? " active" : ""}`} onClick={() => { setActiveFarm(f.id); setSelected(null); }}>{f.name}</button>
        ))}
      </div>

      {activeFarm === "all" && (
        <div className="all-farms">
          <div className="holistic-summary">
            <div><span className="num">{combinedCover}</span><span className="lbl">avg cover (kg DM/ha)</span></div>
            <div><span className="num">{combinedGrowth}</span><span className="lbl">avg growth (kg DM/ha/day)</span></div>
            <div><span className="num">{totalPaddocks}</span><span className="lbl">paddocks total</span></div>
            <div><span className="num">{totalFlagged}</span><span className="lbl">flagged / no data</span></div>
          </div>
          <div className="farm-cards">
            {FARMS.map((f) => (
              <button key={f.id} className="farm-card" onClick={() => setActiveFarm(f.id)}>
                <div className="fc-top">
                  <span className="fc-name">{f.name}</span>
                  <ChevronRight size={16} />
                </div>
                <div className="fc-stats">
                  <div><span className="num">{f.wedgeCover}</span><span className="lbl">avg cover</span></div>
                  <div><span className="num">{f.weightedAvgGrowth}</span><span className="lbl">avg growth</span></div>
                  <div><span className="num">{f.paddocks.length}</span><span className="lbl">paddocks</span></div>
                  <div><span className="num" style={{ color: f.flaggedCount ? COLORS.flagged : "var(--ink)" }}>{f.flaggedCount}</span><span className="lbl">flagged</span></div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {current && (
        <div className="farm-detail">
          <div className="wedge-info-box">
            <div><span className="wib-k">Wedge Cover</span><span className="wib-v">{current.wedgeCover}</span></div>
            <div><span className="wib-k">Weighted Avg</span><span className="wib-v">{current.weightedAvgGrowth}</span></div>
            <div><span className="wib-k">DM Produced</span><span className="wib-v">{current.dmProduced}</span></div>
            <div><span className="wib-k">Avg Residual</span><span className="wib-v">{current.avgResidual}</span></div>
            <div><span className="wib-k">Paddocks</span><span className="wib-v">{current.paddocks.length}</span></div>
          </div>

          <div className="wedge-legend">
            <div><span className="wedge-swatch" style={{ background: COLORS.normal }} />Grazing</div>
            <div><span className="wedge-swatch" style={{ background: COLORS.grown }} />Grown</div>
            <div><span className="wedge-swatch" style={{ background: COLORS.flagged }} />No data</div>
            <div><span className="wedge-swatch line" />Trend</div>
          </div>

          <div className="wedge-chart-scroll">
            <div style={{ width: chartWidth }}>
              <ComposedChart width={chartWidth} height={190} data={sorted} margin={{ top: 14, right: 4, left: 0, bottom: 0 }}>
                <YAxis width={38} tick={{ fontSize: 9, fill: COLORS.inkSoft }} label={{ value: "Cover kg DM/ha", angle: -90, position: "insideLeft", fontSize: 9, fill: COLORS.inkSoft }} />
                <Tooltip
                  formatter={(v, name) => [v, name === "cover" ? "Grazing" : name === "grown" ? "Grown" : name]}
                  labelFormatter={(code) => code}
                  contentStyle={{ fontSize: 11, background: COLORS.card, border: `1px solid ${COLORS.paperDeep}` }}
                />
                <Bar dataKey="cover" stackId="wedge" onClick={(d) => setSelected(d)} cursor="pointer">
                  {sorted.map((p) => (
                    <Cell key={p.code} fill={p.flagged ? COLORS.flagged : COLORS.normal} opacity={selected?.code === p.code ? 1 : 0.92} />
                  ))}
                </Bar>
                <Bar dataKey="grown" stackId="wedge" fill={COLORS.grown} onClick={(d) => setSelected(d)} cursor="pointer" radius={[2, 2, 0, 0]}>
                  <LabelList dataKey="grown" content={TopLabel} />
                </Bar>
                <Line type="linear" dataKey="trend" stroke={COLORS.trend} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </ComposedChart>

              <div className="wedge-axis-labels" style={{ width: chartWidth }}>
                {sorted.map((p) => (
                  <div
                    key={p.code}
                    className={`wedge-axis-label${p.flagged ? " flagged" : ""}${selected?.code === p.code ? " selected" : ""}`}
                    style={{ width: chartWidth / sorted.length }}
                    onClick={() => setSelected(p)}
                  >
                    {p.code}
                  </div>
                ))}
              </div>

              <BarChart width={chartWidth} height={120} data={sorted} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                <YAxis width={38} reversed tick={{ fontSize: 9, fill: COLORS.inkSoft }} label={{ value: "Days since mulched", angle: -90, position: "insideLeft", fontSize: 9, fill: COLORS.inkSoft }} />
                <Tooltip
                  formatter={(v) => [v == null ? "Never logged" : `${v} days`, "Since mulched"]}
                  labelFormatter={(code) => code}
                  contentStyle={{ fontSize: 11, background: COLORS.card, border: `1px solid ${COLORS.paperDeep}` }}
                />
                {avgMulch != null && (
                  <ReferenceLine y={avgMulch} stroke="#B5533C" strokeDasharray="4 3" label={{ value: `Avg ${avgMulch}d`, position: "insideBottomRight", fontSize: 9, fill: "#B5533C" }} />
                )}
                <Bar dataKey="mulchDays" onClick={(d) => setSelected(d)} cursor="pointer" fill={COLORS.mulch} radius={[0, 0, 2, 2]}>
                  <LabelList dataKey="mulchDays" position="top" style={{ fontSize: 7, fill: COLORS.inkSoft }} />
                </Bar>
              </BarChart>
            </div>
          </div>
        </div>
      )}
      {selected && (
        <div className="detail-sheet">
          <div className="ds-head">
            <div>
              <h2>{selected.farm} — {selected.code}</h2>
              {selected.flagged ? (
                <span className="pill flagged"><Droplets size={12} />No data{selected.eventDate ? ` · replanted ${selected.eventDate}` : ""}</span>
              ) : (
                <span className="pill">In rotation</span>
              )}
            </div>
            <X size={18} className="close" onClick={() => setSelected(null)} />
          </div>
          {!selected.flagged && (
            <div className="ds-grid">
              <div><div className="k">Cover</div><div className="v">{selected.cover} kg DM/ha</div></div>
              <div><div className="k">Grown</div><div className="v">+{selected.grown} kg DM/ha</div></div>
              <div><div className="k">Status</div><div className="v">Grazing rotation</div></div>
              <div><div className="k">Mulched</div><div className="v">{selected.mulchDays != null ? `${selected.mulchDays} days ago` : "Never logged"}</div></div>
            </div>
          )}
          {selected.flagged && (
            <p className="ds-note">Excluded from the wedge until it's re-measured — matches the recent replant.</p>
          )}
        </div>
      )}
    </div>
  );
}

function FarmMapScreen({ go, log, walkLog, landTypeMap, setLandType }) {
  const [activeFarm, setActiveFarm] = useState("all");
  const [landCategory, setLandCategory] = useState("all");
  const [selectedCode, setSelectedCode] = useState(null);
  const [nutrientRange, setNutrientRange] = useState("ytd");

  const totalPaddocks = FARMS.reduce((s, f) => s + f.paddocks.length, 0);
  const totalFlagged = FARMS.reduce((s, f) => s + f.flaggedCount, 0);
  const current = FARMS.find((f) => f.id === activeFarm) || null;
  const effectivePaddocks = useMemo(() => {
    if (!current) return [];
    return current.paddocks.map((p) => {
      const walk = getLatestWalk(walkLog, current.id, p.code);
      return walk ? { ...p, cover: walk.cover, flagged: false } : p;
    });
  }, [current, walkLog]);

  const landTypeOf = (code) => landTypeMap[landTypeKey(current.id, code)] || null;
  const landCounts = useMemo(() => {
    if (!current) return {};
    const counts = { all: effectivePaddocks.length, unclassified: 0 };
    LAND_TYPES.forEach((t) => { counts[t] = 0; });
    effectivePaddocks.forEach((p) => {
      const t = landTypeOf(p.code);
      if (t) counts[t] += 1; else counts.unclassified += 1;
    });
    return counts;
  }, [current, effectivePaddocks, landTypeMap]);

  const displayPaddocks = useMemo(() => {
    let list = effectivePaddocks;
    if (landCategory !== "all") {
      list = list.filter((p) => landCategory === "unclassified" ? !landTypeOf(p.code) : landTypeOf(p.code) === landCategory);
    }
    return [...list].sort(byPaddockNumber);
  }, [effectivePaddocks, landCategory, landTypeMap]);

  const layout = useMemo(() => buildFieldLayout(displayPaddocks.length), [displayPaddocks.length]);

  const switchFarm = (id) => { setActiveFarm(id); setLandCategory("all"); setSelectedCode(null); };

  const selectedPaddock = current && selectedCode ? effectivePaddocks.find((p) => p.code === selectedCode) : null;
  const history = selectedPaddock
    ? [
        ...log.filter((l) => l.farmId === current.id && l.paddock === selectedPaddock.code),
        ...walkLog
          .filter((w) => w.farmId === current.id && w.paddock === selectedPaddock.code)
          .map((w) => ({ id: w.id, date: w.date, type: "Pasture walk", notes: `${w.cover} kg DM/ha` })),
      ].sort((a, b) => (a.date < b.date ? 1 : -1))
    : [];

  const nutrientTotals = useMemo(() => {
    if (!selectedPaddock) return null;
    const fertApps = log.filter((l) =>
      l.farmId === current.id && l.paddock === selectedPaddock.code &&
      l.type === "Fertilizer" && l.product && l.rate && withinRange(l.date, nutrientRange)
    );
    return fertApps.reduce((acc, e) => {
      const comp = FERTILIZER_NUTRIENTS[e.product] || { N: 0, P: 0, K: 0, S: 0 };
      acc.N += e.rate * comp.N / 100;
      acc.P += e.rate * comp.P / 100;
      acc.K += e.rate * comp.K / 100;
      acc.S += e.rate * comp.S / 100;
      acc.count += 1;
      return acc;
    }, { N: 0, P: 0, K: 0, S: 0, count: 0 });
  }, [selectedPaddock, log, nutrientRange, current]);

  return (
    <div className="screen">
      <Header title="Farm map" onBack={() => go("farm")} />

      <div className="tabs">
        <button className={`tab${activeFarm === "all" ? " active" : ""}`} onClick={() => switchFarm("all")}>All farms</button>
        {FARMS.map((f) => (
          <button key={f.id} className={`tab${activeFarm === f.id ? " active" : ""}`} onClick={() => switchFarm(f.id)}>{f.name}</button>
        ))}
      </div>

      {activeFarm === "all" && (
        <div className="all-farms">
          <div className="holistic-summary">
            <div><span className="num">{FARMS.length}</span><span className="lbl">farms</span></div>
            <div><span className="num">{totalPaddocks}</span><span className="lbl">paddocks total</span></div>
            <div><span className="num">{totalFlagged}</span><span className="lbl">flagged / no data</span></div>
          </div>
          <div className="farm-cards">
            {FARMS.map((f) => (
              <button key={f.id} className="farm-card" onClick={() => switchFarm(f.id)}>
                <div className="fc-top">
                  <span className="fc-name">{f.name}</span>
                  <ChevronRight size={16} />
                </div>
                <div className="fc-stats">
                  <div><span className="num">{f.paddocks.length}</span><span className="lbl">paddocks</span></div>
                  <div><span className="num" style={{ color: f.flaggedCount ? COLORS.flagged : "var(--ink)" }}>{f.flaggedCount}</span><span className="lbl">flagged</span></div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {current && (
        <div className="land-cat-tabs">
          <button className={`tab${landCategory === "all" ? " active" : ""}`} onClick={() => { setLandCategory("all"); setSelectedCode(null); }}>All ({landCounts.all})</button>
          {LAND_TYPES.map((t) => (
            <button key={t} className={`tab${landCategory === t ? " active" : ""}`} onClick={() => { setLandCategory(t); setSelectedCode(null); }}>{t} ({landCounts[t] || 0})</button>
          ))}
          <button className={`tab${landCategory === "unclassified" ? " active" : ""}`} onClick={() => { setLandCategory("unclassified"); setSelectedCode(null); }}>Unclassified ({landCounts.unclassified})</button>
        </div>
      )}

      {current && (
        <div className="map-wrap">
          <svg viewBox="0 0 900 620" width="100%" height="100%">
            {displayPaddocks.map((p, i) => {
              const geo = layout[i];
              const isSel = selectedCode === p.code;
              const herd = getHerd(current.id, p.code);
              return (
                <g key={p.code} onClick={() => setSelectedCode(p.code)} style={{ cursor: "pointer" }}>
                  <polygon
                    points={geo.points}
                    className={`geo-field${p.flagged ? " flagged" : ""}${isSel ? " selected" : ""}`}
                  />
                  <text x={geo.cx} y={geo.cy + (herd ? 6 : 0)} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: geo.fontSize, fill: "white", fontWeight: 600, pointerEvents: "none" }}>
                    {p.code}
                  </text>
                  {herd && (
                    <g>
                      <text x={geo.cx} y={geo.cy - geo.fontSize * 1.1} textAnchor="middle" style={{ fontSize: geo.fontSize * 1.6, pointerEvents: "none" }}>🐄</text>
                      <text x={geo.cx} y={geo.cy - geo.fontSize * 0.1} textAnchor="middle" style={{ fontSize: Math.max(5, geo.fontSize * 0.75), fill: "white", fontWeight: 700, pointerEvents: "none" }}>{herd.groupName}</text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {selectedPaddock && (
        <div className="detail-sheet">
          <div className="ds-head">
            <div>
              <h2>{selectedPaddock.farm} — {selectedPaddock.code}</h2>
              {selectedPaddock.flagged ? (
                <span className="pill flagged"><Droplets size={12} />No data{selectedPaddock.eventDate ? ` · replanted ${selectedPaddock.eventDate}` : ""}</span>
              ) : (
                <span className="pill">In rotation</span>
              )}
              {getHerd(current.id, selectedPaddock.code) && (
                <span className="pill herd">🐄 {getHerd(current.id, selectedPaddock.code).groupName}</span>
              )}
            </div>
            <X size={18} className="close" onClick={() => setSelectedCode(null)} />
          </div>

          <p className="history-label">Land type</p>
          <div className="chip-wrap" style={{ marginBottom: 14 }}>
            {LAND_TYPES.map((t) => (
              <button
                key={t}
                className={`range-chip${landTypeOf(selectedPaddock.code) === t ? " on" : ""}`}
                onClick={() => setLandType(current.id, selectedPaddock.code, landTypeOf(selectedPaddock.code) === t ? null : t)}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="history-label">Full history</p>
          {history.length === 0 && <p className="ds-note">No activity logged for this field yet.</p>}
          {history.length > 0 && (
            <ul className="history-list">
              {history.map((h) => (
                <li key={h.id} className="history-row">
                  <span className="hr-date">{h.date}</span>
                  <span className="hr-type">
                    {h.type}
                    {h.product ? ` — ${h.product}` : ""}{h.rate ? ` (${h.rate} kg/ha)` : ""}
                    {h.method ? ` — ${h.method}` : ""}{h.depth ? ` (${h.depth} cm)` : ""}
                    {h.mix ? ` — ${h.mix}` : ""}
                  </span>
                  {h.notes && <span className="hr-notes">{h.notes}</span>}
                </li>
              ))}
            </ul>
          )}

          <p className="history-label">Nutrients applied</p>
          <div className="chip-wrap nutrient-range-picker">
            {NUTRIENT_RANGES.map((r) => (
              <button key={r.id} className={`range-chip${nutrientRange === r.id ? " on" : ""}`} onClick={() => setNutrientRange(r.id)}>{r.label}</button>
            ))}
          </div>
          {nutrientTotals && nutrientTotals.count === 0 && (
            <p className="ds-note">No fertilizer logged with a rate in this window.</p>
          )}
          {nutrientTotals && nutrientTotals.count > 0 && (
            <div className="nutrient-grid">
              <div><span className="nutrient-val">{nutrientTotals.N.toFixed(1)}</span><span className="nutrient-lbl">N kg/ha</span></div>
              <div><span className="nutrient-val">{nutrientTotals.P.toFixed(1)}</span><span className="nutrient-lbl">P kg/ha</span></div>
              <div><span className="nutrient-val">{nutrientTotals.K.toFixed(1)}</span><span className="nutrient-lbl">K kg/ha</span></div>
              <div><span className="nutrient-val">{nutrientTotals.S.toFixed(1)}</span><span className="nutrient-lbl">S kg/ha</span></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BurnviewApp() {
  const [screen, setScreen] = useState("home");
  const [activityType, setActivityType] = useState(null);
  const [log, setLog] = useState(seedLog);
  const [walkLog, setWalkLog] = useState([]);
  const [feedStock, setFeedStock] = useState(FEED_ITEMS_SEED);
  const [landStock, setLandStock] = useState([]);
  const [feedLog, setFeedLog] = useState([]);
  const [landLog, setLandLog] = useState([]);
  const [landTypeMap, setLandTypeMap] = useState(DEFAULT_LAND_TYPES);
  const [fieldMeta, setFieldMetaMap] = useState({});
  const go = (s) => setScreen(s);
  const addLogEntry = (entry) => setLog((prev) => [...prev, entry]);
  const addWalkEntries = (entries) => setWalkLog((prev) => [...prev, ...entries]);
  const setLandType = (farmId, code, type) => {
    setLandTypeMap((prev) => {
      const next = { ...prev };
      const key = landTypeKey(farmId, code);
      if (type) next[key] = type; else delete next[key];
      return next;
    });
  };
  const setFieldMeta = (farmId, code, patch) => {
    setFieldMetaMap((prev) => ({ ...prev, [landTypeKey(farmId, code)]: { ...prev[landTypeKey(farmId, code)], ...patch } }));
  };

  const applyFeedEntry = (entry) => {
    setFeedStock((prev) => prev.map((it) => it.id === entry.itemId
      ? { ...it, qty: Math.max(0, it.qty + (entry.mode === "use" ? -entry.qty : entry.qty)) }
      : it));
    setFeedLog((prev) => [...prev, { ...entry, id: `feedlog-${entry.itemId}-${Date.now()}` }]);
  };
  const addFeedItem = (name, unit) => setFeedStock((prev) => [...prev, { id: `feed-${slugify(name)}-${Date.now()}`, name, unit, qty: 0 }]);

  const applyLandEntry = (entry) => {
    setLandStock((prev) => prev.map((it) => it.id === entry.itemId
      ? { ...it, qty: Math.max(0, it.qty + (entry.mode === "use" ? -entry.qty : entry.qty)) }
      : it));
    setLandLog((prev) => [...prev, { ...entry, id: `landlog-${entry.itemId}-${Date.now()}` }]);
  };
  const addLandItem = (category, name, unit) => setLandStock((prev) => [...prev, { id: `land-${category}-${slugify(name)}-${Date.now()}`, category, name, unit, qty: 0 }]);

  return (
    <div className="bv-root" style={{ fontFamily: "inherit" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
        .bv-root { ${baseStyle} background: var(--paper); color: var(--ink); border-radius: 10px; overflow: hidden; height: 640px; max-height: 85vh; max-width: 480px; margin: 0 auto; border: 1px solid var(--paper-deep); display:flex; flex-direction:column; }
        .screen { display: flex; flex-direction: column; flex: 1; min-height: 0; position: relative; }
        .hdr { display: flex; align-items: center; gap: 10px; padding: 16px 18px; border-bottom: 1px solid var(--paper-deep); }
        .hdr h1 { font-size: 16px; margin: 0; font-weight: 700; flex: 1; }
        .hdr-action-slot { display:flex; }
        .hdr-action { display:flex; align-items:center; gap: 5px; font-family: inherit; font-size: 11.5px; font-weight: 600; padding: 6px 10px; border-radius: 20px; border: 1px solid var(--paper-deep); background: var(--card); color: var(--ink); cursor: pointer; }
        .hdr-action:hover { background: var(--paper-deep); }
        .back { background: none; border: none; cursor: pointer; color: var(--ink); display:flex; padding: 2px; }

        .home { align-items: stretch; justify-content: flex-start; padding: 22px 20px; gap: 26px; overflow-y: auto; }
        .brand { display:flex; align-items:center; gap:8px; font-weight:700; font-size:15px; }
        .home-cards { display: flex; flex-direction: column; gap: 14px; margin-top: 10px; }
        .home-card { background: var(--card); border: 1px solid var(--paper-deep); border-radius: 12px; padding: 24px 20px; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; cursor: pointer; text-align:left; }
        .home-card:hover { background: var(--paper-deep); }
        .hc-title { font-size: 17px; font-weight: 700; margin-top: 4px; }
        .hc-sub { font-size: 12.5px; color: var(--ink-soft); }

        .empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; color: var(--ink-soft); padding: 30px; text-align:center; font-size: 13.5px; }

        .menu-list { padding: 8px 0; }
        .menu-row { width: 100%; display:flex; align-items:center; gap: 12px; padding: 14px 18px; background:none; border:none; border-bottom: 1px solid var(--paper-deep); cursor:pointer; text-align:left; }
        .menu-row.disabled { cursor: default; opacity: 0.5; }
        .menu-row:not(.disabled):hover { background: var(--paper-deep); }
        .menu-row-text { display:flex; flex-direction:column; flex:1; }
        .mr-title { font-size: 14px; font-weight: 500; }
        .mr-sub { font-size: 11.5px; color: var(--ink-soft); }

        .tabs { display:flex; gap: 6px; padding: 12px 18px; border-bottom: 1px solid var(--paper-deep); overflow-x:auto; }
        .land-cat-tabs { display:flex; gap: 6px; padding: 10px 18px; border-bottom: 1px solid var(--paper-deep); overflow-x:auto; background: var(--paper-deep); }
        .tab { font-size: 12.5px; padding: 6px 12px; border-radius: 20px; border: 1px solid var(--paper-deep); background: var(--card); cursor:pointer; color: var(--ink-soft); white-space:nowrap; }
        .tab.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }

        .all-farms { padding: 16px 18px; overflow-y:auto; }
        .holistic-summary { display:flex; gap: 18px; margin-bottom: 16px; }
        .holistic-summary .num, .fd-summary .num { font-size: 18px; font-weight: 700; display:block; }
        .holistic-summary .lbl, .fd-summary .lbl { font-size: 10.5px; color: var(--ink-soft); }
        .farm-cards { display:flex; flex-direction:column; gap: 10px; }
        .farm-card { background: var(--card); border: 1px solid var(--paper-deep); border-radius: 10px; padding: 14px 16px; cursor:pointer; text-align:left; }
        .farm-card:hover { background: var(--paper-deep); }
        .fc-top { display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px; }
        .fc-name { font-weight: 600; font-size: 14.5px; }
        .fc-stats { display:flex; gap: 18px; }

        .farm-detail { padding: 14px 18px; overflow-y:auto; flex:1; }
        .fd-summary { display:flex; gap: 18px; margin-bottom: 14px; }
        .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(46px, 1fr)); gap: 6px; }
        .tile { aspect-ratio: 1; border-radius: 6px; border: none; background: var(--normal); color: white; font-size: 10px; font-weight: 600; cursor: pointer; display:flex; align-items:center; justify-content:center; }
        .tile.flagged { background: repeating-linear-gradient(45deg, var(--flagged), var(--flagged) 4px, #7996a0 4px, #7996a0 8px); }
        .tile.selected { outline: 2px solid var(--ink); outline-offset: 1px; }
        .tile:hover { opacity: 0.85; }

        .wedge-chart-scroll { overflow-x: auto; padding-bottom: 4px; }
        .wedge-axis-labels { display:flex; }
        .wedge-axis-label { font-size: 8px; color: var(--ink-soft); writing-mode: vertical-rl; transform: rotate(180deg); text-align:left; white-space:nowrap; cursor:pointer; padding-top: 2px; }
        .wedge-axis-label.flagged { color: var(--flagged); font-weight: 600; }
        .wedge-axis-label.selected { color: var(--ink); font-weight: 700; }

        .wedge-info-box { display: inline-grid; grid-template-columns: auto auto; gap: 2px 12px; border: 1px solid var(--paper-deep); background: var(--card); border-radius: 8px; padding: 10px 14px; margin-bottom: 10px; }
        .wib-k { font-size: 10.5px; color: var(--ink-soft); margin-right: 8px; }
        .wib-v { font-size: 11.5px; font-weight: 600; font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        .wedge-legend { display:flex; gap: 14px; font-size: 11px; color: var(--ink-soft); margin-bottom: 10px; flex-wrap: wrap; }
        .wedge-legend div { display:flex; align-items:center; gap:5px; }
        .wedge-swatch { width: 10px; height: 10px; border-radius: 2px; display:inline-block; }
        .wedge-swatch.line { width: 12px; height: 2px; background: var(--ink); border-radius: 0; }

        .detail-sheet { border-top: 1px solid var(--paper-deep); padding: 16px 18px; background: var(--card); max-height: 46%; overflow-y: auto; flex-shrink: 0; }
        .ds-head { display:flex; justify-content:space-between; align-items:flex-start; }
        .ds-head h2 { font-size: 14.5px; margin: 0 0 6px; }
        .close { cursor:pointer; opacity:0.6; }
        .close:hover { opacity:1; }
        .pill { display:inline-flex; align-items:center; gap:5px; font-size: 11.5px; padding: 3px 9px; border-radius: 20px; background: var(--normal); color:white; margin: 4px 4px 0 0; }
        .pill.herd { background: #B5533C; }
        .pill.flagged { background: var(--flagged); }
        .ds-grid { display:flex; gap: 24px; margin-top: 12px; }
        .ds-grid .k { font-size: 10px; color: var(--ink-soft); text-transform:uppercase; letter-spacing:0.04em; }
        .ds-grid .v { font-size: 13.5px; margin-top: 2px; }
        .ds-note { font-size: 12.5px; color: var(--ink-soft); margin-top: 10px; }

        .activity-scroll { flex: 1; min-height: 0; overflow-y: auto; display:flex; flex-direction:column; }
        .form { padding: 18px; display:flex; flex-direction:column; gap: 16px; flex-shrink: 0; }

        .paddock-picker-head { display:flex; align-items:center; justify-content:space-between; padding: 0 18px 8px; }
        .paddock-picker-actions { display:flex; gap: 12px; }
        .link-btn { background:none; border:none; font-family: inherit; font-size: 11.5px; font-weight: 600; color: var(--normal); cursor: pointer; padding: 0; }
        .link-btn:hover { text-decoration: underline; }
        .paddock-picker-list { padding: 0 18px 12px; display:grid; grid-template-columns: repeat(auto-fill, minmax(52px, 1fr)); gap: 6px; align-content:flex-start; }
        .paddock-chip { position:relative; padding: 9px 4px; border-radius: 7px; border: 1px solid var(--paper-deep); background: var(--card); font-family: inherit; font-size: 11.5px; font-weight: 600; color: var(--ink); cursor: pointer; }
        .paddock-chip.on { background: var(--normal); color: white; border-color: var(--normal); }
        .paddock-chip-check { position:absolute; top: 1px; right: 3px; font-size: 8px; }
        .chip-wrap { display:flex; flex-wrap:wrap; gap: 6px; }
        .fert-chip { width: auto; padding: 8px 12px; }
        .field-hint { font-size: 11px; color: var(--ink-soft); margin-top: 6px; }
        .mix-rows { display:flex; flex-direction:column; gap: 8px; }
        .mix-row { display:flex; align-items:center; justify-content:space-between; gap: 10px; font-size: 13px; }
        .mix-row .field-input { width: 90px; flex-shrink:0; }
        .field { display:flex; flex-direction:column; gap: 6px; }
        .field-label { font-size: 11.5px; color: var(--ink-soft); text-transform:uppercase; letter-spacing:0.04em; }
        .field-input { font-family: inherit; font-size: 14px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--paper-deep); background: var(--card); color: var(--ink); }
        .field-input:focus { outline: 2px solid var(--normal); outline-offset: -1px; }
        .save-btn { margin-top: 4px; padding: 12px; border-radius: 8px; border: none; background: var(--ink); color: var(--paper); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
        .save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .save-btn:not(:disabled):hover { opacity: 0.9; }
        .save-note { font-size: 12px; color: var(--ink-soft); text-align:center; }

        .walk-datebar { display:flex; align-items:flex-end; gap: 14px; padding: 14px 18px; border-bottom: 1px solid var(--paper-deep); }
        .walk-progress { font-size: 12px; color: var(--ink-soft); padding-bottom: 10px; white-space:nowrap; font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        .walk-list { flex:1; overflow-y:auto; padding: 4px 18px; }
        .walk-row { width:100%; display:flex; align-items:center; gap: 10px; padding: 10px 4px; border: none; border-bottom: 1px solid var(--paper-deep); background: none; font-family: inherit; cursor: pointer; text-align:left; }
        .walk-row.active { background: var(--paper-deep); border-radius: 6px; }
        .wr-code { font-size: 13px; font-weight: 600; width: 46px; flex-shrink:0; }
        .wr-value { flex:1; font-size: 14px; font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        .wr-value.placeholder { color: rgba(91,99,80,0.55); }
        .wr-unit { font-size: 10.5px; color: var(--ink-soft); width: 54px; flex-shrink:0; text-align:right; }
        .field-editor-sub { font-size: 10.5px; color: var(--ink-soft); flex-shrink:0; text-align:right; white-space:nowrap; }
        .walk-save-bar { padding: 14px 18px; border-top: 1px solid var(--paper-deep); display:flex; flex-direction:column; gap: 8px; }
        .walk-save-row { display:flex; gap: 10px; }
        .walk-save-row .save-btn { flex: 2; margin-top: 0; }
        .cancel-btn { flex: 1; padding: 12px; border-radius: 8px; border: 1px solid var(--paper-deep); background: none; color: var(--ink-soft); font-family: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
        .cancel-btn:hover:not(:disabled) { background: var(--paper-deep); color: var(--ink); }
        .cancel-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .keypad-panel { position: absolute; left: 0; right: 0; bottom: 0; border-top: 1px solid var(--paper-deep); background: var(--card); padding: 12px 18px 16px; box-shadow: 0 -6px 16px rgba(35,42,30,0.12); z-index: 10; }
        .keypad-header { display:flex; align-items:center; gap: 10px; margin-bottom: 10px; }
        .keypad-code { font-weight: 700; font-size: 14px; }
        .keypad-value { flex:1; font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 15px; }
        .keypad-unit { font-size: 10.5px; color: var(--ink-soft); font-family: inherit; }
        .keypad-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 10px; }
        .keypad-key { padding: 14px 0; border-radius: 8px; border: 1px solid var(--paper-deep); background: var(--paper); font-family: inherit; font-size: 17px; font-weight: 600; color: var(--ink); cursor: pointer; }
        .keypad-key:hover { background: var(--paper-deep); }
        .keypad-key:active { background: var(--normal); color: white; }
        .keypad-key-alt { background: var(--paper-deep); color: var(--ink-soft); font-size: 14px; }
        .keypad-next { margin-top: 0; }

        .stock-list { flex:1; overflow-y:auto; padding: 4px 18px; }
        .stock-row { width:100%; display:flex; align-items:center; justify-content:space-between; gap: 10px; padding: 12px 4px; border: none; border-bottom: 1px solid var(--paper-deep); background: none; font-family: inherit; cursor: pointer; text-align:left; }
        .stock-row.active { background: var(--paper-deep); border-radius: 6px; }
        .stock-row-name { font-size: 13.5px; font-weight: 500; }
        .stock-row-qty { font-size: 13px; font-family: 'IBM Plex Mono', ui-monospace, monospace; font-weight: 600; }
        .stock-row-qty.zero { color: var(--flagged); font-weight: 500; }
        .add-item-bar { display:flex; gap: 8px; padding: 10px 18px; border-bottom: 1px solid var(--paper-deep); align-items:center; }
        .add-item-bar .field-input { flex: 2; }
        .add-item-bar select.field-input { flex: 1; }
        .field-input.small { padding: 8px 10px; font-size: 13px; }
        .save-btn.small { margin-top: 0; padding: 8px 14px; font-size: 12.5px; white-space:nowrap; }

        .stock-panel-title { display:flex; flex-direction:column; gap: 2px; flex: 1; }
        .stock-panel-qty { font-size: 11px; color: var(--ink-soft); }
        .mode-toggle { display:flex; gap: 8px; margin-bottom: 10px; }
        .mode-btn { flex:1; padding: 8px; border-radius: 8px; border: 1px solid var(--paper-deep); background: var(--paper); font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--ink-soft); cursor: pointer; }
        .mode-btn.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
        .stock-panel-fields { display:flex; flex-direction:column; gap: 8px; margin-bottom: 10px; }
        .keypad-value-row { text-align:center; font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 20px; font-weight: 600; margin-bottom: 10px; }
        .keypad-value-row .keypad-unit { font-size: 11px; font-weight: 400; color: var(--ink-soft); font-family: inherit; }

        .map-wrap { flex: 1; padding: 8px; min-height: 300px; }
        .geo-field { fill: var(--normal); stroke: var(--paper); stroke-width: 3; transition: opacity 0.15s ease; }
        .geo-field:hover { opacity: 0.85; }
        .geo-field.flagged { fill: var(--flagged); }
        .geo-field.selected { stroke: var(--ink); stroke-width: 2.5; }
        .history-label { font-size: 11px; color: var(--ink-soft); text-transform:uppercase; letter-spacing:0.04em; margin: 4px 0 8px; }
        .nutrient-range-picker { margin-bottom: 10px; }
        .range-chip { padding: 5px 10px; border-radius: 20px; border: 1px solid var(--paper-deep); background: var(--paper); font-family: inherit; font-size: 11px; font-weight: 600; color: var(--ink-soft); cursor: pointer; }
        .range-chip.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
        .nutrient-grid { display:flex; gap: 16px; }
        .nutrient-grid div { display:flex; flex-direction:column; }
        .nutrient-val { font-size: 17px; font-weight: 700; font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        .nutrient-lbl { font-size: 10px; color: var(--ink-soft); }
        .history-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; max-height:160px; overflow-y:auto; }
        .history-row { display:flex; align-items:baseline; gap: 10px; font-size: 13px; }
        .hr-date { font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 11.5px; color: var(--ink-soft); flex-shrink:0; }
        .hr-type { font-weight: 600; flex-shrink:0; }
        .hr-notes { color: var(--ink-soft); font-size: 12.5px; }
      `}</style>

      {screen === "home" && <HomeScreen go={go} />}
      {screen === "cattle" && <CattleScreen go={go} />}
      {screen === "stocks" && <StocksScreen go={go} />}
      {screen === "feed-stock" && <FeedStockScreen go={go} feedStock={feedStock} applyFeedEntry={applyFeedEntry} addFeedItem={addFeedItem} />}
      {screen === "feeding" && <FeedingScreen go={go} />}
      {screen === "land-stock" && <LandStockScreen go={go} landStock={landStock} applyLandEntry={applyLandEntry} addLandItem={addLandItem} />}
      {screen === "food" && <FoodScreen go={go} />}
      {screen === "farm" && <FarmScreen go={go} />}
      {screen === "field-editor" && <FieldEditorScreen go={go} fieldMeta={fieldMeta} setFieldMeta={setFieldMeta} landTypeMap={landTypeMap} setLandType={setLandType} />}
      {screen === "map" && <FarmMapScreen go={go} log={log} walkLog={walkLog} landTypeMap={landTypeMap} setLandType={setLandType} />}
      {screen === "wedge" && <FarmWedgeScreen go={go} log={log} walkLog={walkLog} />}
      {screen === "data-entry" && <DataEntryScreen go={go} />}
      {screen === "pasture-walk" && <PastureWalkScreen go={go} walkLog={walkLog} addWalkEntries={addWalkEntries} />}
      {screen === "activities" && <ActivitiesScreen go={go} setActivityType={setActivityType} />}
      {screen === "activity-form" && <ActivityFormScreen go={go} activityType={activityType} addLogEntry={addLogEntry} setLandType={setLandType} />}
    </div>
  );
}
