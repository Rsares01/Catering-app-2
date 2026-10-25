import { get, put } from "@vercel/blob";

const BLOB_PATH = "restaurant-abrechnung/archive.json";

async function readArchive() {
  try {
    const blob = await get(BLOB_PATH, { access: "private" });
    if (!blob || blob.statusCode !== 200) return [];
    const data = JSON.parse(await new Response(blob.stream).text());
    return Array.isArray(data.records) ? data.records : [];
  } catch (error) {
    if (error?.statusCode === 404 || error?.code === "BLOB_NOT_FOUND") return [];
    throw error;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const records = await readArchive();
    if (req.method === "GET") {
      return res.status(200).json({ records: records.map(({ pdfBase64, ...meta }) => ({ ...meta, pdfBase64 })) });
    }
    const { date, kind, employee, amount, pdfBase64 } = req.body || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) || !pdfBase64 || !["Abendkasse", "Montags Rotary"].includes(kind)) {
      return res.status(400).json({ error: "Unvollständige Abrechnungsdaten." });
    }
    const month = date.slice(0, 7);
    const sequence = records.filter(item => item.date?.slice(0, 7) === month).length + 1;
    const number = month.replace("-", "") + "-" + String(sequence).padStart(3, "0");
    const filename = (kind === "Montags Rotary" ? "Montags-Rotary-" : "Abendkasse-") + number + ".pdf";
    const record = { number, date, month, kind, employee: String(employee || ""), amount: String(amount || ""), filename, pdfBase64, createdAt: new Date().toISOString() };
    const updated = [...records, record];
    await put(BLOB_PATH, JSON.stringify({ records: updated, updatedAt: new Date().toISOString() }), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
      cacheControlMaxAge: 0,
    });
    return res.status(201).json({ record: { number, filename, date, month, kind, amount } });
  } catch (error) {
    console.error("Archive operation failed", error);
    return res.status(500).json({ error: "Archiv konnte nicht gespeichert oder gelesen werden." });
  }
}
