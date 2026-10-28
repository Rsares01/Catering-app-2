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
  if (!["GET", "POST", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const records = await readArchive();
    if (req.method === "GET") {
      return res.status(200).json({ records: records.map(({ pdfBase64, ...meta }) => ({ ...meta, pdfBase64 })) });
    }
    if (req.method === "DELETE") {
      const { number, createdAt } = req.body || {};
      if (!number || !createdAt) return res.status(400).json({ error: "Archiv-Eintrag nicht eindeutig angegeben." });
      const exists = records.some(item => item.number === number && item.createdAt === createdAt);
      if (!exists) return res.status(404).json({ error: "Diese Abrechnung wurde nicht gefunden oder bereits gelöscht." });
      const updated = records.filter(item => !(item.number === number && item.createdAt === createdAt));
      await put(BLOB_PATH, JSON.stringify({ records: updated, updatedAt: new Date().toISOString() }), {
        access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 0,
      });
      return res.status(200).json({ deleted: true, number });
    }
    const { date, abschlussnummer, kind, employee, amount, amountResult, items, invoiceFoodItems, invoiceFoodTotal, tableclothQuantity, tableclothTotal, pdfBase64 } = req.body || {};
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) || !pdfBase64 || !["Abendkasse", "Montags Rotary"].includes(kind)) {
      return res.status(400).json({ error: "Unvollständige Abrechnungsdaten." });
    }
    const month = date.slice(0, 7);
    const sequence = records.filter(item => item.date?.slice(0, 7) === month).reduce((max, item) => Math.max(max, Number(String(item.number || "").split("-").at(-1)) || 0), 0) + 1;
    const number = month.replace("-", "") + "-" + String(sequence).padStart(3, "0");
    const filename = (kind === "Montags Rotary" ? "Montags-Rotary-" : "Abendkasse-") + number + ".pdf";
    const safeItems = Array.isArray(items) ? items.filter(item => item && typeof item.name === "string").map(item => ({ name: item.name.slice(0, 160), quantity: Math.max(0, Number(item.quantity) || 0), unitPrice: Math.max(0, Number(item.unitPrice) || 0), total: Math.max(0, Number(item.total) || 0) })) : [];
    const safeInvoiceFoodItems = Array.isArray(invoiceFoodItems) ? invoiceFoodItems.filter(item => item && typeof item.name === "string").map(item => ({ name: item.name.slice(0, 160), quantity: Math.max(0, Number(item.quantity) || 0), unitPrice: Math.max(0, Number(item.unitPrice) || 0), total: Math.max(0, Number(item.total) || 0) })) : [];
    const record = { number, date, abschlussnummer: String(abschlussnummer || "").slice(0, 100), month, kind, employee: String(employee || ""), amount: String(amount || ""), amountResult: String(amountResult || ""), items: safeItems, invoiceFoodItems: safeInvoiceFoodItems, invoiceFoodTotal: String(invoiceFoodTotal || ""), tableclothQuantity: kind === "Montags Rotary" ? Math.max(0, Number(tableclothQuantity) || 0) : 0, tableclothTotal: kind === "Montags Rotary" ? Math.max(0, Number(tableclothTotal) || 0) : 0, filename, pdfBase64, createdAt: new Date().toISOString() };
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
