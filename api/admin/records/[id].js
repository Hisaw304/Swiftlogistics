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
    console.log("✏️ PATCH request received. raw id:", id);
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

    if (Object.keys(set).length === 0) {
      console.log("❌ No valid fields provided");
      return res.status(400).json({ error: "No valid fields" });
    }

    set.updatedAt = new Date().toISOString();
    set.lastUpdated = set.updatedAt;

    // build $or filter to match either _id (ObjectId) or trackingId
    const orClauses = [{ trackingId: id }];
    try {
      if (ObjectId.isValid(id)) orClauses.unshift({ _id: new ObjectId(id) });
    } catch (e) {
      console.warn("ObjectId construction failed:", e);
    }
    console.log("➡️ PATCH $or filter:", orClauses);

    const updateResult = await col.findOneAndUpdate(
      { $or: orClauses },
      { $set: set },
      { returnDocument: "after" }
    );

    if (!updateResult.value) {
      console.log("❌ PATCH: no document matched for id:", id);
      return res.status(404).json({ error: "Not found" });
    }

    console.log(
      "✅ PATCH updated:",
      updateResult.value._id || updateResult.value.trackingId
    );
    return res.json(updateResult.value);
  }

  // === DEBUG DELETE branch — temporary ===
  if (req.method === "DELETE") {
    try {
      console.log("🗑 DEBUG DELETE invoked. raw id:", id);

      // basic DB / collection introspection
      const adminInfo = {
        dbName: db.databaseName || null,
        // try to get a collection count (catch errors)
        collection: "trackings",
      };
      let colCount = null;
      try {
        colCount = await col.countDocuments();
      } catch (e) {
        console.error("Could not count documents:", String(e));
      }
      console.log(
        "DEBUG db name:",
        adminInfo.dbName,
        "collection:",
        adminInfo.collection,
        "count:",
        colCount
      );

      // build the candidate filters
      const filters = [];
      try {
        if (ObjectId.isValid(id)) {
          filters.push({ _id: new ObjectId(id) });
        }
      } catch (e) {
        console.warn("ObjectId construction warning:", String(e));
      }
      filters.push({ trackingId: id });

      console.log("DEBUG filters:", JSON.stringify(filters));

      // run findOne for each filter and capture sample doc if found
      const founds = [];
      for (const f of filters) {
        try {
          const doc = await col.findOne(f);
          founds.push({
            filter: f,
            found: !!doc,
            sample: doc
              ? {
                  _id: doc._id?.toString?.() || String(doc._id),
                  trackingId: doc.trackingId || null,
                }
              : null,
          });
          console.log(
            "DEBUG findOne ->",
            JSON.stringify(f),
            "found:",
            !!doc,
            "sample:",
            doc ? doc._id?.toString?.() || doc.trackingId : null
          );
        } catch (err) {
          console.error(
            "DEBUG findOne error for filter",
            JSON.stringify(f),
            String(err)
          );
          founds.push({ filter: f, error: String(err) });
        }
      }

      // Do a single $or delete (same as production plan) and capture result
      const orFilter = filters.length === 1 ? filters[0] : { $or: filters };
      console.log("DEBUG performing deleteOne with:", JSON.stringify(orFilter));
      let delResult = { deletedCount: 0 };
      try {
        delResult = await col.deleteOne(orFilter);
        console.log("DEBUG deleteOne result:", JSON.stringify(delResult));
      } catch (err) {
        console.error("DEBUG deleteOne error:", String(err));
      }

      // Return a rich JSON payload so we don't have to read logs
      return res.json({
        ok: true,
        debug: {
          dbName: adminInfo.dbName,
          collection: adminInfo.collection,
          collectionCount: colCount,
          rawId: id,
          triedFilters: filters,
          founds,
          deleteResult: delResult,
        },
      });
    } catch (outer) {
      console.error("DEBUG DELETE outer error:", String(outer));
      return res
        .status(500)
        .json({ error: "Debug delete failed", detail: String(outer) });
    }
  }

  console.log("⚠️ Method not allowed:", req.method);
  return res.status(405).json({ error: "Method not allowed" });
}
