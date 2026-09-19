"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { KeypadGrid } from "@/components/KeypadGrid";
import { byPaddockNumber, todayStr } from "@/lib/utils";
import type { Farm, StockItem } from "@/lib/types";

export function StockEntryPanel({
  item,
  farms,
  showPaddock,
  onClose,
  onSaved,
}: {
  item: StockItem;
  farms: Farm[];
  showPaddock: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<"USE" | "RESTOCK" | "COUNT">("USE");
  const [farmId, setFarmId] = useState(farms[0]?.id || "");
  const [paddockId, setPaddockId] = useState("");
  const [qty, setQty] = useState("");
  const [freshEntry, setFreshEntry] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);

  const farm = farms.find((f) => f.id === farmId);
  const canSave = qty !== "" && (mode === "COUNT" ? Number(qty) >= 0 : Number(qty) > 0) && date && farmId;

  const switchMode = (m: "USE" | "RESTOCK" | "COUNT") => {
    setMode(m);
    if (m === "COUNT") {
      setQty(String(item.qty));
      setFreshEntry(true);
    } else {
      setQty("");
    }
  };

  const handleKey = (k: string) => {
    setQty((prev) => {
      if (k === "C") { setFreshEntry(false); return ""; }
      if (k === "⌫") { setFreshEntry(false); return prev.slice(0, -1); }
      // Prefilled with the current level on switching to Count — the
      // first digit typed should start a fresh number, not append to it.
      const base = freshEntry ? "" : prev;
      setFreshEntry(false);
      return (base + k).slice(0, 6);
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/stock-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemId: item.id,
        mode,
        qty: Number(qty),
        date,
        farmId,
        paddockId: showPaddock && paddockId ? paddockId : null,
      }),
    });
    setSaving(false);
    onSaved();
  };

  return (
    <div className="keypad-panel stock-panel">
      <div className="keypad-header">
        <div className="stock-panel-title">
          <span className="keypad-code">{item.name}</span>
          <span className="stock-panel-qty">{item.qty} {item.unit} in stock</span>
        </div>
        <button className="close" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="mode-toggle">
        <button className={`mode-btn${mode === "USE" ? " active" : ""}`} onClick={() => switchMode("USE")}>Use</button>
        <button className={`mode-btn${mode === "RESTOCK" ? " active" : ""}`} onClick={() => switchMode("RESTOCK")}>Restock</button>
        <button className={`mode-btn${mode === "COUNT" ? " active" : ""}`} onClick={() => switchMode("COUNT")}>Count</button>
      </div>

      <div className="stock-panel-fields">
        <select className="field-input small" value={farmId} onChange={(e) => { setFarmId(e.target.value); setPaddockId(""); }}>
          {farms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        {showPaddock && mode === "USE" && farm && (
          <select className="field-input small" value={paddockId} onChange={(e) => setPaddockId(e.target.value)}>
            <option value="">No specific paddock</option>
            {[...farm.paddocks].sort(byPaddockNumber).map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
          </select>
        )}
        <input className="field-input small" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="keypad-value-row">{qty || "0"} <span className="keypad-unit">{item.unit}</span></div>
      <KeypadGrid onKey={handleKey} />
      <button className="save-btn keypad-next" onClick={handleSave} disabled={!canSave || saving}>
        {saving ? "Saving…" : mode === "USE" ? "Log usage" : mode === "RESTOCK" ? "Log restock" : "Set stock level"}
      </button>
    </div>
  );
}
