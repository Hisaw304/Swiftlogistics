// pages/api/admin/records/[id].js
import { ObjectId } from "mongodb";
import { connectToDatabase } from "../../shared/mongo.js";

/**
 * Robust admin id handler with clear logs
 * - logs every request (method + url + key)
 * - normalizes common id shapes (trackingId or ObjectId string)
 * - rejects "undefined"/"null" path segments early
 * - implements GET, PATCH, DELETE and responds clearly for other methods
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

  // === Quick debug logging (will show in Vercel logs) ===
  console.log("➡️ /api/admin/records/[id] incoming:", {
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

  // Respond to preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // === Resolve id robustly ===
  let id;
  try {
    if (req.query && req.query.id) id = req.query.id;
    else {
      const url = req.url || "";
      const parts = url.split("/").filter(Boolean);
      const idx = parts.lastIndexOf("records");
      if (idx >= 0 && parts.length > idx + 1) {
        id = parts
          .slice(idx + 1)
          .join("/")
          .split("?")[0];
      } else if (parts.length) {
        id = parts[parts.length - 1].split("?")[0];
      }
    }
  } catch (e) {
    console.warn("⚠️ id resolution failed:", e);
    id = undefined;
  }

  // sanitize obviously invalid id strings
  if (id === "undefined" || id === "null" || id === "" || id === null) {
    id = undefined;
  }

  console.log("➡️ resolved id:", id);

  // === Auth check ===
  if (!ADMIN(req)) {
    console.log("🔴 Unauthorized admin key:", req.headers["x-admin-key"]);
    return res.status(401).json({ error: "Unauthorized" });
  }

  // === DB connection ===
  const { db } = await connectToDatabase();
  const col = db.collection("trackings");

  // === Helper for filters ===
  const buildFilters = (rawId) => {
    const filters = [];
    try {
      if (rawId && ObjectId.isValid(rawId)) {
        filters.push({ _id: new ObjectId(rawId) });
      }
    } catch (e) {
      console.warn("⚠️ ObjectId check failed:", e);
    }
    if (rawId) filters.push({ trackingId: rawId });
    return filters;
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
    console.log("✏️ PATCH start. id:", id);
    if (!id) {
      return res.status(400).json({ error: "Missing id in path or query" });
    }

    // read body robustly
    let bodyRaw = "";
    try {
      if (typeof req.body === "string") bodyRaw = req.body;
      else if (req.body && Object.keys(req.body).length)
        bodyRaw = JSON.stringify(req.body);
      else {
        for await (const chunk of req) bodyRaw += chunk;
      }
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

    const orClauses = [{ trackingId: id }];
    try {
      if (ObjectId.isValid(id)) orClauses.unshift({ _id: new ObjectId(id) });
    } catch (e) {
      console.warn("⚠️ ObjectId construction failed:", e);
    }

    console.log(
      "➡️ PATCH trying filters:",
      JSON.stringify(orClauses),
      "payload:",
      set
    );

    let result;
    try {
      result = await col.findOneAndUpdate(
        { $or: orClauses },
        { $set: set },
        { returnDocument: "after" }
      );
    } catch (err) {
      console.error("❌ findOneAndUpdate error:", String(err));
      return res
        .status(500)
        .json({ error: "update failed", detail: String(err) });
    }

    if (!result?.value) {
      console.log(
        "❌ PATCH: no document matched for id:",
        id,
        "tried:",
        orClauses
      );
      return res
        .status(404)
        .json({ error: "Not found", triedFilters: orClauses, idResolved: id });
    }

    const updatedDoc = {
      ...result.value,
      _id: result.value._id?.toString?.() || result.value._id,
    };
    console.log("✅ PATCH updated:", updatedDoc._id || updatedDoc.trackingId);
    return res.json(updatedDoc);
  }

  // === DELETE ===
  if (req.method === "DELETE") {
    if (!id)
      return res.status(400).json({ error: "Missing id in path or query" });

    const orClauses = [{ trackingId: id }];
    try {
      if (ObjectId.isValid(id)) orClauses.unshift({ _id: new ObjectId(id) });
    } catch (e) {}

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

  console.log("⚠️ Method not allowed reached:", req.method);
  return res.status(405).json({ error: "Method not allowed" });
}
