export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const url = process.env.COMPANY_SYNC_URL;
  const token = process.env.COMPANY_SYNC_TOKEN;
  if (!url || !token) return res.status(503).json({ error: "Gemeinsame Firmenliste ist noch nicht konfiguriert." });
  try {
    const response = await fetch(url, {
      method: req.method,
      headers: { Authorization: `Bearer ${token}`, ...(req.method === "POST" ? { "Content-Type": "application/json" } : {}) },
      ...(req.method === "POST" ? { body: JSON.stringify({ companies: Array.isArray(req.body?.companies) ? req.body.companies : [] }) } : {})
    });
    const body = await response.json();
    return res.status(response.status).json(body);
  } catch {
    return res.status(502).json({ error: "Gemeinsame Firmenliste derzeit nicht erreichbar." });
  }
}
