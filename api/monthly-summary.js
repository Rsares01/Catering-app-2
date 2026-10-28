import { get, put } from "@vercel/blob";
import { jsPDF } from "jspdf";

const ARCHIVE_PATH = "restaurant-abrechnung/archive.json";
const euro = value => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(value) || 0);
const monthLabel = month => {
  const [year, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, m - 1, 1)));
};
async function readBlobJson(path) {
  try {
    const blob = await get(path, { access: "private" });
    if (!blob || blob.statusCode !== 200) return null;
    return JSON.parse(await new Response(blob.stream).text());
  } catch (error) {
    if (error?.statusCode === 404 || error?.code === "BLOB_NOT_FOUND") return null;
    throw error;
  }
}
function getPreviousMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
}
function makePdf(month, rotaryRecords) {
  const doc = new jsPDF();
  const lines = [
    "MONATLICHE ROTARY-DOKUMENTATION",
    "Schützenhaus / Gastronomie",
    "Monat: " + monthLabel(month),
    "Anzahl Rotary-Abrechnungen: " + rotaryRecords.length,
    "",
    "TISCHDECKEN-PAUSCHALEN (nur Dokumentation)",
  ];
  let clothCount = 0;
  let clothTotal = 0;
  let invoiceFoodTotal = 0;
  for (const record of rotaryRecords) {
    const count = Number(record.tableclothQuantity) || 5;
    const fee = Number(record.tableclothTotal) || count * 9.5;
    clothCount += count;
    clothTotal += fee;
    lines.push(record.date + " | " + record.number + " | " + count + " Stück | " + euro(fee));
  }
  lines.push("", "Gesamt Tischdecken: " + clothCount + " Stück", "Summe Tischdecken-Pauschalen: " + euro(clothTotal), "", "ESSEN AUF RECHNUNG ROTARY (nur Dokumentation)");
  for (const record of rotaryRecords) {
    const items = Array.isArray(record.invoiceFoodItems) ? record.invoiceFoodItems : [];
    const itemSum = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    invoiceFoodTotal += itemSum;
    if (items.length) {
      lines.push(record.date + " | " + record.number);
      for (const item of items) lines.push("  " + item.name + " | Menge: " + (Number(item.quantity) || 0) + " | " + euro(item.total));
      lines.push("  Summe Essen auf Rechnung: " + euro(itemSum));
    } else {
      lines.push(record.date + " | " + record.number + " | Keine Essen-auf-Rechnung-Positionen erfasst");
    }
  }
  lines.push("", "GESAMTÜBERSICHT", "Tischdecken-Pauschalen: " + euro(clothTotal), "Essen auf Rechnung Rotary: " + euro(invoiceFoodTotal), "Gesamtsumme dokumentierte Zusatzpositionen: " + euro(clothTotal + invoiceFoodTotal), "", "WICHTIG: Diese Dokumentationssummen sind nicht im regulären Artikelumsatz oder Kassenabschluss enthalten.");
  let y = 18;
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, 180);
    if (y + wrapped.length * 7 > 280) { doc.addPage(); y = 18; }
    doc.text(wrapped, 15, y);
    y += wrapped.length * 7;
  }
  return Buffer.from(doc.output("arraybuffer"));
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || "";
  if (!secret || auth !== "Bearer " + secret) return res.status(401).json({ error: "Unauthorized" });
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return res.status(503).json({ error: "E-Mail-Versand ist noch nicht konfiguriert. RESEND_API_KEY und RESEND_FROM_EMAIL fehlen." });
  }
  try {
    const month = getPreviousMonth();
    const sentPath = "restaurant-abrechnung/monthly-sent/" + month + ".json";
    if (await readBlobJson(sentPath)) return res.status(200).json({ sent: false, reason: "already_sent", month });
    const archive = await readBlobJson(ARCHIVE_PATH);
    const records = Array.isArray(archive?.records) ? archive.records : [];
    const rotaryRecords = records.filter(record => record.kind === "Montags Rotary" && String(record.date || "").slice(0, 7) === month).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (!rotaryRecords.length) return res.status(200).json({ sent: false, reason: "no_rotary_records", month });
    const pdf = makePdf(month, rotaryRecords);
    const subject = "Monatsübersicht Rotary – " + monthLabel(month);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL,
        to: ["info@schuetzenhaus-rs.de"],
        subject,
        text: "Guten Tag Ellen Clemes,\n\nanbei erhalten Sie die monatliche PDF-Übersicht der dokumentierten Tischdecken-Pauschalen und Essen auf Rechnung Rotary für " + monthLabel(month) + ". Diese Positionen sind getrennt vom regulären Artikelumsatz und Kassenabschluss ausgewiesen.\n\nViele Grüße",
        attachments: [{ filename: "Rotary-Monatsuebersicht-" + month + ".pdf", content: pdf.toString("base64") }],
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("Monthly report email failed", response.status, result);
      return res.status(502).json({ error: "E-Mail-Versand fehlgeschlagen." });
    }
    await put(sentPath, JSON.stringify({ month, sentAt: new Date().toISOString(), emailId: result.id || null, recipient: "info@schuetzenhaus-rs.de" }), {
      access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 0,
    });
    return res.status(200).json({ sent: true, month, records: rotaryRecords.length });
  } catch (error) {
    console.error("Monthly summary failed", error);
    return res.status(500).json({ error: "Monatsübersicht konnte nicht erstellt oder versendet werden." });
  }
}
