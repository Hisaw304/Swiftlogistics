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
  // robust id extraction — handles cases where req.query.id may be undefined
  let id = (() => {
    // prefer Next/Vercel style param if present
    try {
      if (req.query && req.query.id) return req.query.id;
    } catch (e) {}

    // fallback: try to parse from URL path (works even if rewrites removed query)
    try {
      // req.url can be like "/api/admin/records/<id>" or "/api/admin/records/<id>?..."
      const url = req.url || req.originalUrl || "";
      const parts = url.split("/").filter(Boolean);
      // find last segment after "records"
      const idx = parts.lastIndexOf("records");
      if (idx >= 0 && parts.length > idx + 1) {
        return parts
          .slice(idx + 1)
          .join("/")
          .split("?")[0];
      }
      // otherwise, try full path last segment
      if (parts.length > 0) {
        return parts[parts.length - 1].split("?")[0];
      }
    } catch (e) {}

    // last resort: undefined
    return undefined;
  })();
  console.log("➡️ resolved id:", id);

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
    console.log("✏️ PATCH request received. raw id:", id);

    if (!id) {
      console.error("❌ PATCH: missing id");
      return res
        .status(400)
        .json({ error: "Missing id in request path or query" });
    }

    // parse body
    let body;
    try {
      body =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    } catch (e) {
      console.error("❌ PATCH: invalid JSON body", e);
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    // allowed fields
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
      console.log("❌ No valid fields provided:", Object.keys(body));
      return res.status(400).json({ error: "No valid fields to update" });
    }

    // timestamps
    set.updatedAt = new Date().toISOString();
    set.lastUpdated = set.updatedAt;

    // build $or clauses (ObjectId or trackingId)
    const orClauses = [{ trackingId: id }];
    try {
      if (ObjectId.isValid(id)) orClauses.unshift({ _id: new ObjectId(id) });
    } catch (e) {
      console.warn("ObjectId construction failed:", e);
    }
    console.log("➡️ PATCH $or filter:", JSON.stringify(orClauses));
    console.log("➡️ PATCH update payload:", set);

    // perform update and return AFTER
    let result;
    try {
      result = await col.findOneAndUpdate(
        { $or: orClauses },
        { $set: set },
        { returnDocument: "after" } // returns document after update
      );
    } catch (err) {
      console.error("❌ PATCH: findOneAndUpdate error:", String(err));
      return res
        .status(500)
        .json({ error: "update failed", detail: String(err) });
    }

    if (!result.value) {
      console.log("❌ PATCH: no document matched for id:", id);
      return res.status(404).json({ error: "Not found" });
    }

    // normalize _id to string for client convenience
    const updatedDoc = {
      ...result.value,
      _id: result.value._id?.toString?.() || result.value._id,
    };
    console.log("✅ PATCH updated:", updatedDoc._id || updatedDoc.trackingId);
    return res.json(updatedDoc);
  }

  // === DELETE === (production)
  if (req.method === "DELETE") {
    console.log("🗑 DELETE request. id:", id);

    // If id is still missing, return error (avoid accidental empty filters)
    if (!id) {
      console.error("❌ DELETE: missing id in request");
      return res
        .status(400)
        .json({ error: "Missing id in request path or query" });
    }

    // Build $or filter to match either ObjectId or trackingId
    const orClauses = [{ trackingId: id }];
    try {
      if (ObjectId.isValid(id)) orClauses.unshift({ _id: new ObjectId(id) });
    } catch (e) {
      console.warn("ObjectId construction failed:", e);
    }

    console.log("➡️ delete $or filter:", orClauses);

    try {
      const delResult = await col.deleteOne({ $or: orClauses });
      console.log("🟢 deleteOne result:", JSON.stringify(delResult));
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
