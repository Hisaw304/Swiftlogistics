// /api/admin/records/[id].next.js
import { ObjectId } from "mongodb";
import { connectToDatabase } from "../../_shared/mongo";

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
  const { db } = await connectToDatabase();
  const col = db.collection("trackings");

  const filter = ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { trackingId: id };
  const rec = await col.findOne(filter);
  if (!rec) return res.status(404).json({ error: "Not found" });

  const lastIndex = (rec.route || []).length - 1;
  if (rec.currentIndex >= lastIndex)
    return res.status(400).json({ error: "Already at final checkpoint" });

  const newIndex = rec.currentIndex + 1;
  const checkpoint = rec.route[newIndex];
  const now = new Date().toISOString();
  const historyEntry = {
    timestamp: now,
    location: checkpoint.location,
    city: checkpoint.city,
    note: "Arrived checkpoint",
  };

  const newStatus =
    newIndex === lastIndex
      ? "Delivered"
      : rec.status === "Pending"
      ? "Shipped"
      : rec.status;

  await col.updateOne(filter, {
    $set: {
      currentIndex: newIndex,
      currentLocation: checkpoint.location,
      status: newStatus,
      lastUpdated: now,
      updatedAt: now,
    },
    $push: { locationHistory: historyEntry },
  });

  const updated = await col.findOne(filter);
  return res.json(updated);
}
