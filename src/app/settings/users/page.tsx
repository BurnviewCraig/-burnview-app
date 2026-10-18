"use client";

import { useState } from "react";
import { Pencil, Trash2, X, ShieldAlert, ShieldCheck } from "lucide-react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";
import { useAccess } from "@/lib/useAccess";
import { SECTION_DEFS, type SectionAccess } from "@/lib/permissions";
import type { Farm } from "@/lib/types";

type UserRow = { id: string; username: string; name: string; createdAt: string; isAdmin: boolean; sectionAccess: SectionAccess | null };

// Expands a possibly-null sectionAccess into a concrete, fully-populated
// object so the checkboxes have something definite to show/toggle —
// null means "full access" until the admin touches it, at which point every
// section becomes explicit.
function expand(access: SectionAccess | null, farms: Farm[]): Required<Omit<SectionAccess, "timebook">> & { timebook: string[] } {
  const full = access === null;
  return {
    farm: full ? true : !!access?.farm,
    cattle: full ? true : !!access?.cattle,
    food: full ? true : !!access?.food,
    stocks: full ? true : !!access?.stocks,
    orderNumbers: full ? true : !!access?.orderNumbers,
    diesel: full ? true : !!access?.diesel,
    diary: full ? true : !!access?.diary,
    timebook: full
      ? farms.map((f) => f.slug)
      : access?.timebook === true
      ? farms.map((f) => f.slug)
      : access?.timebook === false || access?.timebook === undefined
      ? []
      : access.timebook,
  };
}

function UsersSettingsPageInner() {
  const { data, loading, refetch } = useApi<{ users: UserRow[] }>("/api/users");
  const users = data?.users ?? [];
  const { data: farmsData } = useApi<{ farms: Farm[] }>("/api/farms");
  const farms = farmsData?.farms ?? [];
  const { me } = useAccess();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editAdmin, setEditAdmin] = useState(false);
  const [editAccess, setEditAccess] = useState<ReturnType<typeof expand> | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const canSave = name.trim() && username.trim() && password.length >= 6;

  const handleAdd = async () => {
    setSaving(true);
    setError(null);
    setAdded(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, password }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Couldn't create that user.");
      return;
    }
    setAdded(username);
    setName("");
    setUsername("");
    setPassword("");
    refetch();
  };

  const startEdit = (u: UserRow) => {
    setEditingId(u.id);
    setEditName(u.name);
    setEditUsername(u.username);
    setEditPassword("");
    setEditAdmin(u.isAdmin);
    setEditAccess(expand(u.sectionAccess, farms));
    setEditError(null);
  };

  const cancelEdit = () => setEditingId(null);

  const handleSaveEdit = async () => {
    if (!editingId || !editAccess) return;
    setEditSaving(true);
    setEditError(null);
    const body: Record<string, unknown> = {
      name: editName,
      username: editUsername,
      isAdmin: editAdmin,
      sectionAccess: editAdmin
        ? null
        : {
            farm: editAccess.farm,
            cattle: editAccess.cattle,
            food: editAccess.food,
            stocks: editAccess.stocks,
            orderNumbers: editAccess.orderNumbers,
            diesel: editAccess.diesel,
            timebook: editAccess.timebook,
          },
    };
    if (editPassword) body.password = editPassword;
    const res = await fetch(`/api/users/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEditSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setEditError(json.error || "Couldn't save that.");
      return;
    }
    setEditingId(null);
    refetch();
  };

  const handleDelete = async (u: UserRow) => {
    if (!confirm(`Delete ${u.name} (@${u.username})? Their past entries stay on record, but they'll no longer be able to sign in.`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error || "Couldn't delete that user.");
      return;
    }
    refetch();
  };

  return (
    <div className="screen">
      <Header title="Users" backHref="/settings" />

      <div className="form">
        <label className="field">
          <span className="field-label">Name</span>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John" />
        </label>
        <label className="field">
          <span className="field-label">Username</span>
          <input className="field-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. john" autoCapitalize="none" />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input className="field-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
        </label>
        {error && <p className="error-note">{error}</p>}
        {added && <p className="save-note">Created &quot;{added}&quot; — share the username and password with them directly.</p>}
        <button className="save-btn" onClick={handleAdd} disabled={!canSave || saving}>
          {saving ? "Creating…" : "Add user"}
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="menu-list">
          {users.map((u) => (
            <div key={u.id} className="settings-row">
              {editingId === u.id ? (
                <div className="form" style={{ width: "100%" }}>
                  <label className="field">
                    <span className="field-label">Name</span>
                    <input className="field-input" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </label>
                  <label className="field">
                    <span className="field-label">Username</span>
                    <input className="field-input" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} autoCapitalize="none" />
                  </label>
                  <label className="field">
                    <span className="field-label">New password (leave blank to keep current)</span>
                    <input className="field-input" type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="At least 6 characters" />
                  </label>
                  <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={editAdmin} onChange={(e) => setEditAdmin(e.target.checked)} disabled={u.id === me?.id} />
                    <span className="field-label" style={{ margin: 0 }}>Admin (full access to everything, incl. managing users)</span>
                  </label>

                  {!editAdmin && editAccess && (
                    <>
                      <span className="field-label">What can they see? Unchecked sections show &quot;Restricted access&quot;.</span>
                      {SECTION_DEFS.filter((s) => s.key !== "timebook").map((s) => (
                        <label key={s.key} className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={!!editAccess[s.key as keyof typeof editAccess]}
                            onChange={(e) => setEditAccess({ ...editAccess, [s.key]: e.target.checked })}
                          />
                          <span className="field-label" style={{ margin: 0 }}>{s.label}</span>
                        </label>
                      ))}
                      <span className="field-label">Time book — per farm</span>
                      {farms.map((f) => (
                        <label key={f.id} className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={editAccess.timebook.includes(f.slug)}
                            onChange={(e) =>
                              setEditAccess({
                                ...editAccess,
                                timebook: e.target.checked
                                  ? [...editAccess.timebook, f.slug]
                                  : editAccess.timebook.filter((s) => s !== f.slug),
                              })
                            }
                          />
                          <span className="field-label" style={{ margin: 0 }}>{f.name}</span>
                        </label>
                      ))}
                    </>
                  )}

                  {editError && <p className="error-note">{editError}</p>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="save-btn" onClick={handleSaveEdit} disabled={editSaving || !editName.trim() || !editUsername.trim()}>
                      {editSaving ? "Saving…" : "Save"}
                    </button>
                    <button className="link-btn" onClick={cancelEdit}><X size={14} /> Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="settings-row-head">
                    <span className="settings-row-title">
                      {u.name} {u.isAdmin && <ShieldCheck size={14} style={{ verticalAlign: "-2px", color: "#2E7D32" }} />}
                    </span>
                    <span className="mr-sub">@{u.username}</span>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="link-btn" onClick={() => startEdit(u)}><Pencil size={14} /></button>
                    {u.id !== me?.id && (
                      <button className="link-btn" onClick={() => handleDelete(u)}><Trash2 size={14} /></button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function UsersSettingsPage() {
  const { loading, isAdmin } = useAccess();
  if (loading) return <div className="screen"><Header title="Users" backHref="/settings" /><Spinner /></div>;
  if (!isAdmin) {
    return (
      <div className="screen">
        <Header title="Users" backHref="/settings" />
        <div className="empty" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingTop: 40 }}>
          <ShieldAlert size={28} strokeWidth={1.5} />
          <span>Restricted access</span>
          <span className="hc-sub">Only admins can manage users.</span>
        </div>
      </div>
    );
  }
  return <UsersSettingsPageInner />;
}
