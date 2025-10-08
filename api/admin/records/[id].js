// pages/api/admin/records/[id].js
import { ObjectId } from "mongodb";
import { connectToDatabase } from "../../shared/mongo.js";

/**
 * Robust admin id handler with debug diagnostics
 * - normalizes id (decode + trim)
 * - rejects "undefined"/"null"
 * - tries ObjectId, trackingId, and string _id matches
 * - logs matchingCount & db name before update
 */

const ADMIN = (req) => {
  const key = req.headers["x-admin-key"] || req.query?.adminKey;
  return key && key === process.env.ADMIN_KEY;
};

export default async function handler(req, res) {
  // === CORS ===
  const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "https://swiftlogistics-mu.vercel.app",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,x-admin-key",
  };
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Content-Type", "application/json");

  // Preflight
  if (req.method === "OPTIONS") return res.status(204).end();

  // Incoming request log
  console.log("➡️ [id] incoming:", {
    method: req.method,
    url: req.url,
    queryId: req.query?.id,
    headers: {
      origin: req.headers.origin,
      referer: req.headers.referer,
      "x-admin-key": req.headers["x-admin-key"],
      "content-type": req.headers["content-type"],
    },
  });

  // === Auth ===
  if (!ADMIN(req)) {
    console.log("🔴 Unauthorized admin key:", req.headers["x-admin-key"]);
    return res.status(401).json({ error: "Unauthorized" });
  }

  // === Resolve id robustly ===
  let rawId;
  try {
    if (req.query && req.query.id) rawId = req.query.id;
    else {
      const url = req.url || "";
      const parts = url.split("/").filter(Boolean);
      const idx = parts.lastIndexOf("records");
      if (idx >= 0 && parts.length > idx + 1) {
        rawId = parts
          .slice(idx + 1)
          .join("/")
          .split("?")[0];
      } else if (parts.length) {
        rawId = parts[parts.length - 1].split("?")[0];
      }
    }
  } catch (e) {
    console.warn("⚠️ id resolution error:", e);
    rawId = undefined;
  }

  const idCandidate = rawId
    ? decodeURIComponent(String(rawId)).trim()
    : undefined;
  const id =
    idCandidate &&
    idCandidate !== "undefined" &&
    idCandidate !== "null" &&
    idCandidate !== ""
      ? idCandidate
      : undefined;

  console.log("➡️ resolved id:", id);

  // === DB connect ===
  const { db } = await connectToDatabase();
  const col = db.collection("trackings");

  // Helper to build robust $or filters
  const buildFilters = (raw) => {
    const ors = [];
    try {
      if (raw && ObjectId.isValid(raw)) ors.push({ _id: new ObjectId(raw) });
    } catch (e) {
      console.warn("⚠️ ObjectId check failed:", e);
    }
    if (raw) {
      ors.push({ trackingId: raw }); // primary string trackingId
      ors.push({ _id: raw }); // fallback in case _id was stored as string
    }
    return ors;
  };

  // === GET ===
  if (req.method === "GET") {
    const filters = buildFilters(id);
    console.log("📦 GET filters:", filters);
    let doc = null;
    for (const f of filters) {
      doc = await col.findOne(f);
      if (doc) break;
    }
    if (!doc) return res.status(404).json({ error: "Not found" });
    if (doc._id && typeof doc._id !== "string") doc._id = doc._id.toString();
    return res.json(doc);
  }

  // === PATCH ===
  if (req.method === "PATCH") {
    if (!id) {
      return res.status(400).json({ error: "Missing id in path or query" });
    }

    // read body robustly
    let bodyRaw = "";
    try {
      if (typeof req.body === "string") bodyRaw = req.body;
      else if (req.body && Object.keys(req.body).length)
        bodyRaw = JSON.stringify(req.body);
      else for await (const chunk of req) bodyRaw += chunk;
    } catch (e) {
      console.error("❌ Error reading body:", e);
    }

    let body = {};
    try {
      body = bodyRaw ? JSON.parse(bodyRaw) : {};
    } catch (e) {
      console.error("❌ invalid JSON body:", e, "raw:", bodyRaw);
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const allowed = [
      "customerName",
      "product",
      "quantity",
      "imageUrl",
      "status",
      "originWarehouse",
      "address",
      "destination",
    ];
    const set = {};
    allowed.forEach((k) => {
      if (body[k] !== undefined) set[k] = body[k];
    });

    if (Object.keys(set).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    set.updatedAt = new Date().toISOString();
    set.lastUpdated = set.updatedAt;

    const orClauses = buildFilters(id);
    console.log(
      "➡️ PATCH filters:",
      JSON.stringify(orClauses),
      "payloadKeys:",
      Object.keys(set)
    );

    // Debug: how many docs match before update, and which DB
    let matchingCount = -1;
    try {
      matchingCount = await col
        .countDocuments({ $or: orClauses })
        .catch((e) => {
          console.error("countDocuments error:", String(e));
          return -1;
        });
      console.log("🔎 matchingCount:", matchingCount, "db:", db.databaseName);
    } catch (e) {
      console.error("🔎 Debug count failed:", String(e));
    }

    // Attempt update (robust, two-step)
    let updateResult;
    try {
      updateResult = await col.updateOne({ $or: orClauses }, { $set: set });
      console.log("➡️ updateOne result:", updateResult);
    } catch (err) {
      console.error("❌ updateOne error:", String(err));
      return res
        .status(500)
        .json({ error: "update failed", detail: String(err) });
    }

    // If nothing matched, report Not found
    if (!updateResult || updateResult.matchedCount === 0) {
      console.log(
        "❌ PATCH: updateOne matchedCount 0 for id:",
        id,
        "tried:",
        orClauses
      );
      return res
        .status(404)
        .json({ error: "Not found", triedFilters: orClauses, idResolved: id });
    }

    // At least one doc matched — fetch the updated document to return it
    let updatedDoc = null;
    try {
      updatedDoc = await col.findOne({ $or: orClauses });
    } catch (e) {
      console.error("❌ findOne after update failed:", String(e));
      return res
        .status(500)
        .json({ error: "fetch after update failed", detail: String(e) });
    }

    if (!updatedDoc) {
      // Defensive fallback (very unlikely since matchedCount > 0)
      console.warn(
        "⚠️ matched >0 but findOne returned null. Returning generic success."
      );
      return res.json({
        ok: true,
        matchedCount: updateResult.matchedCount,
        modifiedCount: updateResult.modifiedCount,
      });
    }

    // Normalize _id to string
    if (updatedDoc._id && typeof updatedDoc._id !== "string") {
      updatedDoc._id = updatedDoc._id.toString();
    }

    console.log(
      "✅ PATCH updated (via updateOne):",
      updatedDoc._id || updatedDoc.trackingId
    );
    return res.json(updatedDoc);
  }

  // === DELETE ===
  if (req.method === "DELETE") {
    if (!id)
      return res.status(400).json({ error: "Missing id in path or query" });

    const orClauses = buildFilters(id);
    try {
      const delResult = await col.deleteOne({ $or: orClauses });
      return res.json({
        ok: true,
        deletedCount: delResult.deletedCount || 0,
        triedFilters: orClauses,
      });
    } catch (err) {
      console.error("❌ deleteOne error:", String(err));
      return res
        .status(500)
        .json({ error: "delete failed", detail: String(err) });
    }
  }

  console.log("⚠️ Method not allowed:", req.method);
  return res.status(405).json({ error: "Method not allowed" });
}
