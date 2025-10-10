// pages/api/geocode.js

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const address = req.query.address;
  if (!address) {
    return res.status(400).json({ error: "Missing address parameter" });
  }

  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ORS_API_KEY not set" });
  }

  try {
    const orsUrl = `https://api.openrouteservice.org/geocode/search?api_key=${apiKey}&text=${encodeURIComponent(
      address
    )}`;

    const response = await fetch(orsUrl);
    const data = await response.json();

    // Optional caching for performance on Vercel
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");

    return res.status(200).json(data);
  } catch (err) {
    console.error("ORS geocode failed", err);
    return res.status(500).json({ error: "Geocoding failed" });
  }
}
