"use client";

import { useEffect, useState } from "react";

type Item = { name: string; size: number; uploaded_at: string; email?: string };

export default function Home() {
  const [pw, setPw] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("admin_pw");
    if (saved) {
      setPw(saved);
      setLoggedIn(true);
      loadList();
    }
  }, []);

  async function loadList() {
    const r = await fetch("/api?action=list");
    const d = await r.json();
    setItems(d.items || []);
  }

  async function login() {
    const r = await fetch("/api?action=login", {
      method: "POST",
      headers: { "x-admin-password": pw },
    });
    if (!r.ok) {
      setStatus({ type: "error", msg: "Password salah" });
      return;
    }
    localStorage.setItem("admin_pw", pw);
    setLoggedIn(true);
    setStatus(null);
    loadList();
  }

  function logout() {
    localStorage.removeItem("admin_pw");
    setPw("");
    setLoggedIn(false);
    setItems([]);
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setStatus(null);

    let ok = 0, fail = 0;
    for (const f of Array.from(files)) {
      try {
        const fd = new FormData();
        fd.append("file", f);
        const r = await fetch("/api?action=upload", {
          method: "POST",
          headers: { "x-admin-password": pw },
          body: fd,
        });
        if (!r.ok) throw new Error(await r.text());
        ok++;
      } catch {
        fail++;
      }
    }
    setUploading(false);
    e.target.value = "";

    if (fail === 0) setStatus({ type: "success", msg: `✅ ${ok} file berhasil` });
    else if (ok === 0) setStatus({ type: "error", msg: `❌ ${fail} file gagal` });
    else setStatus({ type: "success", msg: `⚠️ ${ok} sukses, ${fail} gagal` });

    loadList();
  }

  async function hapus(name: string) {
    if (!confirm(`Hapus ${name}?`)) return;
    const r = await fetch("/api?action=delete", {
      method: "POST",
      headers: { "x-admin-password": pw, "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (r.ok) {
      setStatus({ type: "success", msg: `🗑️ ${name} dihapus` });
      loadList();
    } else {
      setStatus({ type: "error", msg: "Gagal hapus" });
    }
  }

  function fmtSize(b: number) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  if (!loggedIn) {
    return (
      <div className="container">
        <h1>📧 Gmail Kredensial</h1>
        <p className="subtitle">Login dulu</p>
        <div className="card" style={{ maxWidth: 400 }}>
          <h2>🔐 Login Admin</h2>
          {status && <div className={`status ${status.type}`}>{status.msg}</div>}
          <input
            type="password"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            autoFocus
          />
          <button onClick={login} style={{ width: "100%" }}>Masuk</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1>📧 Gmail Kredensial</h1>
          <p className="subtitle">{items.length} file</p>
        </div>
        <button className="refresh-btn" onClick={logout}>Logout</button>
      </div>

      {status && <div className={`status ${status.type}`}>{status.msg}</div>}

      <div className="card">
        <h2>📤 Upload</h2>
        <label className="file-input">
          <input type="file" accept=".json,application/json" multiple onChange={upload} disabled={uploading} />
          <div className="file-input-label">
            {uploading ? (
              <><span className="spinner" />Uploading...</>
            ) : (
              <><strong>Klik pilih file</strong><br />Bisa multiple .json</>
            )}
          </div>
        </label>
        <p className="file-meta">
          💡 Nama file: <code>email_gmail_com.json</code> biar email otomatis.
        </p>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ marginBottom: 0 }}>📂 Daftar</h2>
          <button className="refresh-btn" onClick={loadList}>🔄 Refresh</button>
        </div>
        {items.length === 0 ? (
          <div className="empty">Belum ada file</div>
        ) : (
          <div className="file-list">
            {items.map((it) => (
              <div key={it.name} className="file-item">
                <div className="file-info">
                  <div className="file-name">{it.name}</div>
                  {it.email && <div className="file-email">📧 {it.email}</div>}
                  <div className="file-meta">{fmtSize(it.size)} · {fmtDate(it.uploaded_at)}</div>
                </div>
                <button className="danger small" onClick={() => hapus(it.name)}>Hapus</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}