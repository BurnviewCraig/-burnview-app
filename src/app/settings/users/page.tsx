"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { Spinner } from "@/components/Spinner";
import { useApi } from "@/lib/useApi";

type UserRow = { id: string; username: string; name: string; createdAt: string };

export default function UsersSettingsPage() {
  const { data, loading, refetch } = useApi<{ users: UserRow[] }>("/api/users");
  const users = data?.users ?? [];

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

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
              <div className="settings-row-head">
                <span className="settings-row-title">{u.name}</span>
                <span className="mr-sub">@{u.username}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
