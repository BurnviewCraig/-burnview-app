"use client";

import { useState } from "react";
import { Plus, Boxes } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { StockEntryPanel } from "@/components/StockEntryPanel";
import { useApi } from "@/lib/useApi";
import { LAND_CATEGORIES } from "@/lib/constants";
import type { Farm, StockItem } from "@/lib/types";

export default function LandStockPage() {
  const { data: itemsData, loading, refetch } = useApi<{ items: StockItem[] }>("/api/stock-items?kind=LAND_INPUT");
  const { data: farmsData } = useApi<{ farms: Farm[] }>("/api/farms");
  const allItems = itemsData?.items ?? [];
  const farms = farmsData?.farms ?? [];

  const [category, setCategory] = useState("fertilizer");
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("bags");

  const catName = LAND_CATEGORIES.find((c) => c.id === category)!.name;
  const items = allItems.filter((i) => i.category === category);
  const activeItem = items.find((i) => i.id === activeItemId) ?? null;

  const switchCat = (c: string) => { setCategory(c); setActiveItemId(null); setAdding(false); };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await fetch("/api/stock-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "LAND_INPUT", category, name: newName.trim(), unit: newUnit }),
    });
    setNewName("");
    setAdding(false);
    refetch();
  };

  if (loading) return <div className="screen"><Header title="Land inputs" backHref="/stocks" /><Spinner /></div>;

  return (
    <div className="screen">
      <Header
        title="Land inputs"
        backHref="/stocks"
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
          farms={farms}
          showPaddock={true}
          onClose={() => setActiveItemId(null)}
          onSaved={() => { setActiveItemId(null); refetch(); }}
        />
      )}
    </div>
  );
}
