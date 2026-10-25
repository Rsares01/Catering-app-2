import { get, put } from "@vercel/blob";

const BLOB_PATH = "restaurant-abrechnung/companies.json";

async function readCompanies() {
  const blob = await get(BLOB_PATH, { access: "private" });
  if (!blob || blob.statusCode !== 200) return [];
  const text = await new Response(blob.stream).text();
  const data = JSON.parse(text);
  return Array.isArray(data.companies) ? data.companies : [];
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const companies = await readCompanies();

    if (req.method === "GET") {
      return res.status(200).json({ companies });
    }

    const incoming = Array.isArray(req.body?.companies) ? req.body.companies : [];
    const normalized = [...new Set([...companies, ...incoming]
      .map((name) => String(name ?? "").trim())
      .filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));

    await put(BLOB_PATH, JSON.stringify({ companies: normalized, updatedAt: new Date().toISOString() }), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });

    return res.status(200).json({ companies: normalized });
  } catch (error) {
    if (error?.statusCode === 404 || error?.code === "BLOB_NOT_FOUND") {
      if (req.method === "GET") return res.status(200).json({ companies: [] });
    }
    console.error("Company cloud sync failed", error);
    return res.status(500).json({ error: "Firmenliste konnte nicht synchronisiert werden." });
  }
}
