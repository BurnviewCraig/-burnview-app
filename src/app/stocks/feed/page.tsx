"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { StockEntryPanel } from "@/components/StockEntryPanel";
import { useApi } from "@/lib/useApi";
import type { Farm, StockItem } from "@/lib/types";

export default function FeedStockPage() {
  const { data: itemsData, loading, refetch } = useApi<{ items: StockItem[] }>("/api/stock-items?kind=FEED");
  const { data: farmsData } = useApi<{ farms: Farm[] }>("/api/farms");
  const items = itemsData?.items ?? [];
  const farms = farmsData?.farms ?? [];

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("tons");

  const activeItem = items.find((i) => i.id === activeItemId) ?? null;

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await fetch("/api/stock-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "FEED", name: newName.trim(), unit: newUnit }),
    });
    setNewName("");
    setAdding(false);
    refetch();
  };

  if (loading) return <div className="screen"><Header title="Feed stock" backHref="/stocks" /><Spinner /></div>;

  return (
    <div className="screen">
      <Header
        title="Feed stock"
        backHref="/stocks"
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
          showPaddock={false}
          onClose={() => setActiveItemId(null)}
          onSaved={() => { setActiveItemId(null); refetch(); }}
        />
      )}
    </div>
  );
}
