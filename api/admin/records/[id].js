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
    // prevent caching of preflight responses
    res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    console.log("🟢 OPTIONS preflight hit");
    return res.status(204).end();
  }

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

  // === Helper to build filters ===
  const buildFilters = (rawId) => {
    const filters = [];
    try {
      if (ObjectId.isValid(rawId)) {
        filters.push({ _id: new ObjectId(rawId) });
      }
    } catch {}
    // always include trackingId fallback (string)
    filters.push({ trackingId: rawId });
    return filters;
  };

  // === GET ===
  if (req.method === "GET") {
    const filters = buildFilters(id);
    console.log("📦 Fetching record using filters:", filters);
    // try each filter until we find a document
    let doc = null;
    for (const f of filters) {
      doc = await col.findOne(f);
      if (doc) break;
    }
    if (!doc) {
      console.log("❌ Record not found for id:", id);
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

    // try filters in order, update the first match
    const filters = buildFilters(id);
    let updated = null;
    for (const f of filters) {
      const result = await col.updateOne(f, { $set: set });
      console.log(
        "🟢 Update result for filter",
        f,
        ":",
        JSON.stringify(result)
      );
      if (result.matchedCount > 0) {
        updated = await col.findOne(f);
        break;
      }
    }

    if (!updated) {
      console.log("❌ No document matched for PATCH with id:", id);
      return res.status(404).json({ error: "Not found" });
    }

    console.log("✅ Updated document:", updated?.trackingId || updated?._id);
    return res.json(updated);
  }

  // === DELETE ===
  if (req.method === "DELETE") {
    console.log("🗑 DELETE request received. raw id:", id);
    const filters = buildFilters(id);
    console.log("➡️ Attempting delete with filters:", filters);

    let delResult = { deletedCount: 0 };
    let usedFilter = null;

    // Try each filter until one deletes
    for (const f of filters) {
      const result = await col.deleteOne(f);
      console.log("🟢 deleteOne result for", f, ":", JSON.stringify(result));
      if (result.deletedCount && result.deletedCount > 0) {
        delResult = result;
        usedFilter = f;
        break;
      }
    }

    console.log(
      "🟡 Final delete result:",
      JSON.stringify(delResult),
      "usedFilter:",
      usedFilter
    );
    return res.json({
      ok: true,
      deletedCount: delResult.deletedCount || 0,
      usedFilter,
    });
  }

  console.log("⚠️ Method not allowed:", req.method);
  return res.status(405).json({ error: "Method not allowed" });
}
