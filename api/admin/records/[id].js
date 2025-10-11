// pages/api/admin/records/[id].js
import { ObjectId } from "mongodb";
import { connectToDatabase } from "../../shared/mongo.js";

const ADMIN = (req) => {
  const key = req.headers["x-admin-key"] || req.query?.adminKey || null;
  return key && key === process.env.ADMIN_KEY;
};

function safeToIso(d) {
  if (!d) return null;
  try {
    const dd = new Date(d);
    if (isNaN(dd.getTime())) return null;
    return dd.toISOString();
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  // ---- CORS + base headers ----
  const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "https://swiftlogistics-mu.vercel.app",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,x-admin-key",
  };
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");

  if (req.method === "OPTIONS") return res.status(204).end();

  // Auth
  if (!ADMIN(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ---- Resolve id param early so all branches can use it safely ----
  let id;
  try {
    // Prefer parsed query (Next may provide it), else derive from URL
    id =
      req.query?.id ||
      (() => {
        const url = req.url || "";
        const parts = url.split("/").filter(Boolean);
        // try to find 'records' then the next segment(s)
        const idx = parts.lastIndexOf("records");
        if (idx >= 0 && parts.length > idx + 1) {
          // join the remainder (handles /records/:id and /records/:id/...)
          return decodeURIComponent(
            parts
              .slice(idx + 1)
              .join("/")
              .split("?")[0]
          );
        }
        // fallback to last segment
        return decodeURIComponent(
          parts.length ? parts[parts.length - 1].split("?")[0] : ""
        );
      })();
  } catch (e) {
    id = undefined;
  }
  if (id === "undefined" || id === "null" || id === "") id = undefined;

  // connect DB
  let conn;
  try {
    conn = await connectToDatabase();
  } catch (dbErr) {
    console.error(
      "DB connection failed:",
      dbErr && dbErr.stack ? dbErr.stack : String(dbErr)
    );
    return res
      .status(500)
      .json({ error: "Database connection failed", detail: String(dbErr) });
  }
  const { db } = conn;
  const col = db.collection("trackings");

  // -------------------- GET by id or trackingId --------------------
  if (req.method === "GET") {
    const filters = [];
    try {
      if (id && ObjectId.isValid(id)) filters.push({ _id: new ObjectId(id) });
    } catch {}
    if (id) filters.push({ trackingId: id });

    let doc = null;
    for (const f of filters) {
      doc = await col.findOne(f);
      if (doc) break;
    }
    if (!doc) return res.status(404).json({ error: "Not found" });
    if (doc._id && typeof doc._id !== "string") doc._id = doc._id.toString();
    return res.json(doc);
  }

  // -------------------- PATCH — update fields (per-record) --------------------
  if (req.method === "PATCH") {
    if (!id)
      return res
        .status(400)
        .json({ error: "Missing id in request path or query" });

    let body = {};
    try {
      body =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    // fields allowed to be set directly
    const allowedTop = [
      "serviceType",
      "shipmentDetails",
      "productDescription",
      "quantity",
      "weightKg",
      "description",
      "shipmentDate",
      "expectedDeliveryDate",
      "status",
      "progressPct",
    ];

    const set = {};
    for (const k of allowedTop) {
      if (body[k] !== undefined) set[k] = body[k];
    }
    if (body.origin !== undefined) set.origin = body.origin;
    if (body.destination !== undefined) set.destination = body.destination;
    if (body.currentIndex !== undefined)
      set.currentIndex = Number(body.currentIndex);

    if (Object.keys(set).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const now = new Date().toISOString();

    // Build query to find by _id or trackingId
    const orClauses = [];
    try {
      if (ObjectId.isValid(id)) orClauses.push({ _id: new ObjectId(id) });
    } catch (e) {}
    orClauses.push({ trackingId: id });

    const rec = await col.findOne({ $or: orClauses });
    if (!rec) return res.status(404).json({ error: "Not found" });

    // --- Recompute derived fields similar to original logic ---
    const existingIndex = Number.isFinite(Number(rec.currentIndex))
      ? Number(rec.currentIndex)
      : 0;
    let newIndex = existingIndex;

    // If destination provided and has city, try to match route city
    if (body.destination && body.destination.city && Array.isArray(rec.route)) {
      const city = String(body.destination.city || "").toLowerCase();
      const match = rec.route.findIndex((r) => {
        const c = r && r.city ? String(r.city).toLowerCase() : "";
        return c && city && c.startsWith(city);
      });
      if (match >= 0) newIndex = match;
    }

    // If admin provided currentIndex explicitly, override
    if (
      body.currentIndex !== undefined &&
      Number.isFinite(Number(body.currentIndex))
    ) {
      newIndex = Number(body.currentIndex);
    }

    const totalStops = Array.isArray(rec.route) ? rec.route.length : 0;
    const lastIndex = totalStops > 0 ? totalStops - 1 : 0;

    // If status explicitly set to Delivered, set index to last
    if (body.status && String(body.status).toLowerCase() === "delivered") {
      newIndex = lastIndex;
      set.status = "Delivered";
      set.progressPct = 100;
    }

    // If newIndex differs, set it and pick currentLocation from route if available
    if (Number(newIndex) !== Number(existingIndex)) {
      set.currentIndex = Number(newIndex);
      if (
        Array.isArray(rec.route) &&
        rec.route[newIndex] &&
        rec.route[newIndex].location
      ) {
        set.currentLocation = rec.route[newIndex].location;
      }
    }

    // Compute progressPct when not explicitly provided
    if (body.progressPct === undefined) {
      if (totalStops > 1) {
        set.progressPct = Math.round(
          (Number(newIndex) / (totalStops - 1)) * 100
        );
      } else {
        set.progressPct = rec.progressPct ?? 0;
      }
    }

    // If destination provided with location, update currentLocation and push history
    const histPush = [];
    if (
      body.destination &&
      body.destination.location &&
      body.destination.location.type === "Point"
    ) {
      set.currentLocation = body.destination.location;
      histPush.push({
        timestamp: now,
        city: body.destination.address?.city || body.destination.city || null,
        location: body.destination.location,
        note: "Admin updated destination location",
        by: "admin",
      });
    } else if (
      body.destination &&
      (body.destination.address?.city || body.destination.city)
    ) {
      histPush.push({
        timestamp: now,
        city: body.destination.address?.city || body.destination.city || null,
        location: body.destination.location || rec.currentLocation || null,
        note: "Admin updated destination city",
        by: "admin",
      });
    }

    set.updatedAt = now;
    set.lastUpdated = now;

    const updateObj = { $set: set };
    if (histPush.length) {
      updateObj.$push = { locationHistory: { $each: histPush } };
    }

    try {
      const result = await col.findOneAndUpdate({ $or: orClauses }, updateObj, {
        returnDocument: "after",
      });
      if (!result?.value)
        return res.status(500).json({ error: "Update failed" });
      const updated = result.value;
      if (updated._id && typeof updated._id !== "string")
        updated._id = updated._id.toString();
      return res.json(updated);
    } catch (err) {
      console.error("PATCH update error:", String(err));
      return res
        .status(500)
        .json({ error: "update failed", detail: String(err) });
    }
  }

  // -------------------- DELETE --------------------
  if (req.method === "DELETE") {
    // id was already resolved above
    const idParam = id || (req.query && req.query.id) || null;
    if (!idParam) {
      return res.status(400).json({ error: "Missing id in path or query" });
    }

    try {
      // prefer _id if it's a valid ObjectId to avoid ambiguous $or issues
      let query;
      if (ObjectId.isValid(String(idParam))) {
        query = { _id: new ObjectId(String(idParam)) };
      } else {
        query = { trackingId: String(idParam) };
      }

      const result = await col.findOneAndDelete(query);
      if (!result.value) {
        return res.status(404).json({ error: "Record not found" });
      }
      const deleted = result.value;
      if (deleted._id && typeof deleted._id !== "string")
        deleted._id = deleted._id.toString();
      return res.status(200).json({ message: "Record deleted", deleted });
    } catch (err) {
      console.error("DELETE /api/admin/records/[id] error:", err);
      return res
        .status(500)
        .json({ error: "Delete failed", detail: String(err) });
    }
  }

  // fallback
  return res.status(405).json({ error: "Method not allowed" });
}
