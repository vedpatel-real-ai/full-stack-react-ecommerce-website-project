export default function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store");
  res
    .status(503)
    .json({ error: "Merchant services are disabled in this deployment." });
}
