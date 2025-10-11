// /api/admin/records/[id].location.js
import { ObjectId } from "mongodb";
import { connectToDatabase } from "../../../shared/mongo.js";

function requireAdmin(req) {
  const key = req.headers["x-admin-key"] || req.query.adminKey;
  return key && key === process.env.ADMIN_KEY;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (!requireAdmin(req))
    return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { id } = req.query;
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { lat, lng, city, note } = body;

  if ((!lat || !lng) && !city)
    return res.status(400).json({ error: "Provide lat/lng or city" });

  const { db } = await connectToDatabase();
  const col = db.collection("trackings");

  const filter = ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { trackingId: id };

  const rec = await col.findOne(filter);
  if (!rec) return res.status(404).json({ error: "Not found" });

  const location =
    lat && lng
      ? { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] }
      : rec.currentLocation || null;

  const now = new Date().toISOString();
  const hist = {
    timestamp: now,
    location,
    city: city || (rec.currentLocation ? null : "Unknown"),
    note: note || "Manual update",
  };

  // 🔹 Update currentIndex if city matches a route checkpoint
  let newIndex = rec.currentIndex;
  if (city && Array.isArray(rec.route)) {
    const match = rec.route.findIndex((r) =>
      r.city.toLowerCase().startsWith(city.toLowerCase())
    );
    if (match >= 0) newIndex = match;
  }

  // 🔹 Calculate progress percentage based on route length
  const totalStops = Array.isArray(rec.route) ? rec.route.length : 0;
  const progressPct =
    totalStops > 1 ? Math.round((newIndex / (totalStops - 1)) * 100) : 0;

  // 🔹 Update MongoDB record
  await col.updateOne(filter, {
    $set: {
      currentIndex: newIndex,
      currentLocation: location,
      lastUpdated: now,
      updatedAt: now,
      progressPct, // ✅ added
    },
    $push: { locationHistory: hist },
  });

  // Return updated record
  const updated = await col.findOne(filter);
  return res.json(updated);
}
