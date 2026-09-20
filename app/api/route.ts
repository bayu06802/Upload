import { put, list, del } from "@vercel/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PASSWORD = process.env.ADMIN_PASSWORD || "bayu";

function isAuth(req: Request): boolean {
  return (req.headers.get("x-admin-password") || "") === PASSWORD;
}

function tebakEmail(nama: string): string {
  const base = nama.replace(/\.json$/, "").toLowerCase();
  const m = base.match(/^(.+?)_(gmail|yahoo|outlook|hotmail|icloud)_com$/);
  if (m) return `${m[1]}@${m[2]}.com`;
  if (/^[a-z0-9._-]+$/.test(base)) return `${base}@gmail.com`;
  return "";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // GET /api?action=list
  if (action === "list") {
    try {
      const { blobs } = await list({ prefix: "kredensial/" });
      const items = blobs
        .map((b) => {
          const name = b.pathname.replace("kredensial/", "");
          return {
            name,
            size: b.size,
            uploaded_at: b.uploadedAt.toISOString(),
            email: tebakEmail(name),
          };
        })
        .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
      return Response.json({ ok: true, items });
    } catch (e: any) {
      return Response.json({ ok: false, items: [], error: e?.message }, { status: 500 });
    }
  }

  // GET /api?action=file&name=xxx.json
  if (action === "file") {
    const name = url.searchParams.get("name") || "";
    if (!name) return new Response("name kosong", { status: 400 });

    try {
      const { blobs } = await list({ prefix: `kredensial/${name}` });
      const found = blobs.find((b) => b.pathname === `kredensial/${name}`);
      if (!found) return new Response("Tidak ditemukan", { status: 404 });

      const r = await fetch(found.url, { cache: "no-store" });
      const text = await r.text();
      return new Response(text, {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    } catch (e: any) {
      return new Response("Error: " + e?.message, { status: 500 });
    }
  }

  // GET /api?action=ping
  if (action === "ping") {
    return Response.json({ ok: true, time: new Date().toISOString() });
  }

  return Response.json({ ok: false, error: "action tidak dikenal" }, { status: 400 });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (!isAuth(req)) {
    return Response.json({ ok: false, error: "Password salah" }, { status: 401 });
  }

  // POST /api?action=login
  if (action === "login") {
    return Response.json({ ok: true });
  }

  // POST /api?action=upload   (multipart/form-data)
  if (action === "upload") {
    try {
      const fd = await req.formData();
      const file = fd.get("file") as File | null;
      if (!file) return Response.json({ ok: false, error: "File kosong" }, { status: 400 });

      const text = await file.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        return Response.json({ ok: false, error: "Bukan JSON valid" }, { status: 400 });
      }
      if (parsed.installed || parsed.web) {
        return Response.json({ ok: false, error: "Ini client_secret, bukan token" }, { status: 400 });
      }
      if (!parsed.refresh_token && !parsed.token) {
        return Response.json({ ok: false, error: "Tidak ada refresh_token/token" }, { status: 400 });
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      if (!safeName.endsWith(".json")) {
        return Response.json({ ok: false, error: "Harus .json" }, { status: 400 });
      }

      const blob = await put(`kredensial/${safeName}`, text, {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
      });

      return Response.json({ ok: true, name: safeName, url: blob.url });
    } catch (e: any) {
      return Response.json({ ok: false, error: e?.message }, { status: 500 });
    }
  }

  // POST /api?action=delete   (JSON body: { name })
  if (action === "delete") {
    try {
      const { name } = await req.json();
      if (!name) return Response.json({ ok: false, error: "Nama kosong" }, { status: 400 });

      const { blobs } = await list({ prefix: `kredensial/${name}` });
      const found = blobs.find((b) => b.pathname === `kredensial/${name}`);
      if (!found) return Response.json({ ok: false, error: "Tidak ada" }, { status: 404 });

      await del(found.url);
      return Response.json({ ok: true });
    } catch (e: any) {
      return Response.json({ ok: false, error: e?.message }, { status: 500 });
    }
  }

  return Response.json({ ok: false, error: "action tidak dikenal" }, { status: 400 });
}
