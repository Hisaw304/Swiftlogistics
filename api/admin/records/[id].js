// /api/admin/records/[id].js
import { ObjectId } from "mongodb";
import { connectToDatabase } from "../../_shared/mongo.js";

const ADMIN = (req) => {
  const key = req.headers["x-admin-key"] || req.query.adminKey;
  return key && key === process.env.ADMIN_KEY;
};

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (!ADMIN(req)) return res.status(401).json({ error: "Unauthorized" });

  const { db } = await connectToDatabase();
  const col = db.collection("trackings");
  const { id } = req.query;
  let filter;
  if (ObjectId.isValid(id)) filter = { _id: new ObjectId(id) };
  else filter = { trackingId: id };

  if (req.method === "GET") {
    const doc = await col.findOne(filter);
    if (!doc) return res.status(404).json({ error: "Not found" });
    return res.json(doc);
  }

  if (req.method === "PATCH") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const allowed = [
      "customerName",
      "product",
      "quantity",
      "imageUrl",
      "status",
      "originWarehouse",
      "address",
    ];
    const set = {};
    allowed.forEach((k) => {
      if (body[k] !== undefined) set[k] = body[k];
    });
    if (Object.keys(set).length === 0)
      return res.status(400).json({ error: "No valid fields" });
    set.updatedAt = new Date().toISOString();
    set.lastUpdated = set.updatedAt;
    await col.updateOne(filter, { $set: set });
    const updated = await col.findOne(filter);
    return res.json(updated);
  }

  if (req.method === "DELETE") {
    await col.deleteOne(filter);
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
