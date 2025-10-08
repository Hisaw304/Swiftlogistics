// /api/admin/records/[id].js
import { ObjectId } from "mongodb";
import { connectToDatabase } from "../../shared/mongo.js";

const ADMIN = (req) => {
  const key = req.headers["x-admin-key"] || req.query.adminKey;
  return key && key === process.env.ADMIN_KEY;
};

export default async function handler(req, res) {
  console.log("➡️ [id].js reached:", req.method, req.query.id);

  // === CORS setup ===
  const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "https://swiftlogistics-mu.vercel.app",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,x-admin-key",
  };

  // Respond to preflight
  if (req.method === "OPTIONS") {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    console.log("🟢 OPTIONS preflight hit");
    return res.status(204).end();
  }

  // Apply headers
  // Apply headers
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader("Content-Type", "application/json");
  // prevent caching of admin API responses
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");

  // === Auth check ===
  if (!ADMIN(req)) {
    console.log("🔴 Unauthorized admin key:", req.headers["x-admin-key"]);
    return res.status(401).json({ error: "Unauthorized" });
  }

  // === Database connection ===
  const { db } = await connectToDatabase();
  const col = db.collection("trackings");

  const { id } = req.query;
  let filter;

  if (ObjectId.isValid(id)) {
    filter = { _id: new ObjectId(id) };
    console.log("🟢 Using _id filter:", filter);
  } else {
    filter = { trackingId: id };
    console.log("🟢 Using trackingId filter:", filter);
  }

  // === GET ===
  if (req.method === "GET") {
    console.log("📦 Fetching record...");
    const doc = await col.findOne(filter);
    if (!doc) {
      console.log("❌ Record not found");
      return res.status(404).json({ error: "Not found" });
    }
    console.log("✅ Record found:", doc.trackingId || doc._id);
    return res.json(doc);
  }

  // === PATCH ===
  if (req.method === "PATCH") {
    console.log("✏️ PATCH request received...");
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    console.log("📦 Body:", body);

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

    if (Object.keys(set).length === 0) {
      console.log("❌ No valid fields provided");
      return res.status(400).json({ error: "No valid fields" });
    }

    set.updatedAt = new Date().toISOString();
    set.lastUpdated = set.updatedAt;

    const result = await col.updateOne(filter, { $set: set });
    console.log("🟢 Update result:", result);

    const updated = await col.findOne(filter);
    console.log("✅ Updated document:", updated?.trackingId || updated?._id);
    return res.json(updated);
  }

  // === DELETE ===
  if (req.method === "DELETE") {
    console.log("🗑 DELETE request received for:", filter);
    const delResult = await col.deleteOne(filter);
    console.log("🟢 Delete result:", JSON.stringify(delResult));
    // return deletedCount so client can validate deletion
    return res.json({ ok: true, deletedCount: delResult.deletedCount });
  }

  console.log("⚠️ Method not allowed:", req.method);
  return res.status(405).json({ error: "Method not allowed" });
}
