"use client";

import { useState } from "react";
import { X, Plus, Trash2, ChevronDown } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { ORDER_NUMBER_ISSUERS } from "@/lib/constants";
import type { Farm, OrderNumber } from "@/lib/types";

export default function OrderNumbersPage() {
  const { data, loading, error, refetch } = useApi<{ orderNumbers: OrderNumber[] }>("/api/order-numbers");
  const orderNumbers = data?.orderNumbers ?? [];
  const { data: farmsData } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];

  const [active, setActive] = useState<OrderNumber | null>(null);
  const [company, setCompany] = useState("");
  const [farmId, setFarmId] = useState("");
  const [item, setItem] = useState("");
  const [comment, setComment] = useState("");
  const [pickingIssuer, setPickingIssuer] = useState(false);
  const [creatingPrefix, setCreatingPrefix] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const openEntry = (o: OrderNumber) => {
    setActive(o);
    setCompany(o.company ?? "");
    setFarmId(o.farmId ?? "");
    setItem(o.item ?? "");
    setComment(o.comment ?? "");
    setConfirmingDelete(false);
    setPickingIssuer(false);
  };

  const handlePickIssuer = async (prefix: string) => {
    setCreatingPrefix(prefix);
    const res = await fetch("/api/order-numbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix }),
    });
    setCreatingPrefix(null);
    setPickingIssuer(false);
    if (!res.ok) return;
    const json = await res.json();
    refetch();
    openEntry(json.orderNumber);
  };

  const handleSave = async () => {
    if (!active) return;
    setSaving(true);
    const res = await fetch(`/api/order-numbers/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: company.trim(),
        farmId: farmId || null,
        item: item.trim(),
        comment: comment.trim(),
      }),
    });
    setSaving(false);
    if (!res.ok) return;
    setActive(null);
    refetch();
  };

  const handleDelete = async () => {
    if (!active) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setDeleting(true);
    await fetch(`/api/order-numbers/${active.id}`, { method: "DELETE" });
    setDeleting(false);
    setActive(null);
    setConfirmingDelete(false);
    refetch();
  };

  if (loading) return <div className="screen"><Header title="Order numbers" backHref="/" /><Spinner /></div>;
  if (error) return <div className="screen"><Header title="Order numbers" backHref="/" /><div className="empty">{error}</div></div>;

  return (
    <div className="screen">
      <Header title="Order numbers" backHref="/" />

      <div style={{ padding: "10px 18px 0" }}>
        <button className="link-btn" onClick={() => setPickingIssuer((v) => !v)}>
          <Plus size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />
          New order number
          <ChevronDown size={14} style={{ verticalAlign: "-2px", marginLeft: 2 }} />
        </button>
      </div>

      {pickingIssuer && (
        <div className="chip-wrap" style={{ padding: "8px 18px" }}>
          {ORDER_NUMBER_ISSUERS.map((issuer) => (
            <button
              key={issuer.prefix}
              className="range-chip"
              onClick={() => handlePickIssuer(issuer.prefix)}
              disabled={creatingPrefix != null}
            >
              {creatingPrefix === issuer.prefix ? "Creating…" : issuer.name}
            </button>
          ))}
        </div>
      )}

      {orderNumbers.length === 0 ? (
        <p className="ds-note" style={{ padding: "12px 18px" }}>No order numbers yet — create one above.</p>
      ) : (
        <div className="walk-list" style={{ paddingBottom: active ? 320 : 0 }}>
          {orderNumbers.map((o) => (
            <button key={o.id} className={`walk-row${active?.id === o.id ? " active" : ""}`} onClick={() => openEntry(o)}>
              <span className="wr-code">{o.prefix}{o.number}</span>
              <span className="field-editor-sub">
                {o.company || "No company set"}
                {o.item ? ` · ${o.item}` : ""}
                {o.farm ? ` · ${o.farm.name}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="keypad-panel">
          <div className="keypad-header">
            <div className="stock-panel-title">
              <span className="keypad-code">{active.prefix}{active.number}</span>
            </div>
            <X size={18} className="close" onClick={() => setActive(null)} />
          </div>

          <label className="field">
            <span className="field-label">Company</span>
            <input className="field-input small" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. FMS" autoFocus />
          </label>

          <label className="field">
            <span className="field-label">Farm</span>
            <select className="field-input small" value={farmId} onChange={(e) => setFarmId(e.target.value)}>
              <option value="">(none)</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Item (what it's itemised under)</span>
            <input className="field-input small" value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Irrigation" />
          </label>

          <label className="field">
            <span className="field-label">Comment / explanation</span>
            <textarea className="field-input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Replacement drag line" />
          </label>

          <button className="save-btn keypad-next" onClick={handleSave} disabled={saving} style={{ marginTop: 14 }}>
            {saving ? "Saving…" : "Save"}
          </button>

          <button className={`delete-btn${confirmingDelete ? " confirm" : ""}`} onClick={handleDelete} disabled={deleting} style={{ marginTop: 10 }}>
            <Trash2 size={14} strokeWidth={1.75} style={{ verticalAlign: "-2px", marginRight: 4 }} />
            {deleting ? "Deleting…" : confirmingDelete ? "Click again to confirm" : "Delete"}
          </button>
        </div>
      )}
    </div>
  );
}
