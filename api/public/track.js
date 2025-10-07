// /api/public/track.js
import { connectToDatabase } from "../shared/mongo.js";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const trackingId = req.query.trackingId || req.query.id;
  if (!trackingId)
    return res.status(400).json({ error: "trackingId required" });

  const { db } = await connectToDatabase();
  const record = await db.collection("trackings").findOne({ trackingId });
  if (!record) return res.status(404).json({ error: "Not found" });

  const route = (record.route || []).map((r) => ({
    city: r.city,
    zip: r.zip,
    location: r.location,
    eta: r.eta,
  }));

  const currentIndex = record.currentIndex ?? 0;
  const progressPct =
    route.length > 1
      ? Math.round((currentIndex / (route.length - 1)) * 100)
      : 0;

  // ✅ Include non-sensitive recipient info
  return res.json({
    trackingId: record.trackingId,
    product: record.product,
    quantity: record.quantity || 1,
    status: record.status,
    imageUrl: record.imageUrl || null,
    originWarehouse: record.originWarehouse || "—",
    customerName: record.customerName || null,
    address: record.address
      ? {
          full: record.address.full || "",
          city: record.address.city || "",
          state: record.address.state || "",
          zip: record.address.zip || "",
        }
      : null,
    route,
    currentIndex,
    currentLocation:
      record.currentLocation || route[currentIndex]?.location || null,
    locationHistory: (record.locationHistory || []).map((h) => ({
      timestamp: h.timestamp,
      city: h.city,
      note: h.note,
    })),
    lastUpdated: record.lastUpdated,
    progressPct,
  });
}
