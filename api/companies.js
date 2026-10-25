import { list, put } from "@vercel/blob";

const BLOB_PATH = "restaurant-abrechnung/companies.json";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: "Cloud-Speicher der Abrechnungs-App ist nicht eingerichtet." });
  }

  try {
    const blobs = await list({ prefix: BLOB_PATH, limit: 10 });
    const blob = blobs.blobs.find((item) => item.pathname === BLOB_PATH);
    let companies = [];

    if (blob) {
      const response = await fetch(blob.url, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        companies = Array.isArray(data.companies) ? data.companies : [];
      }
    }

    if (req.method === "GET") {
      return res.status(200).json({ companies });
    }

    const incoming = Array.isArray(req.body?.companies) ? req.body.companies : [];
    const normalized = [...new Set([...companies, ...incoming]
      .map((name) => String(name ?? "").trim())
      .filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));

    await put(BLOB_PATH, JSON.stringify({ companies: normalized, updatedAt: new Date().toISOString() }), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0
    });

    return res.status(200).json({ companies: normalized });
  } catch (error) {
    console.error("Company cloud sync failed", error);
    return res.status(500).json({ error: "Firmenliste konnte nicht synchronisiert werden." });
  }
}
