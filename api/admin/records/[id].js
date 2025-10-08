// pages/api/admin/records/[id].js
import { ObjectId } from "mongodb";
import { connectToDatabase } from "../../shared/mongo.js";

const ADMIN = (req) => {
  const key = req.headers["x-admin-key"] || req.query?.adminKey;
  return key && key === process.env.ADMIN_KEY;
};

export default async function handler(req, res) {
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
  if (!ADMIN(req)) return res.status(401).json({ error: "Unauthorized" });

  // resolve id (same robust logic as before)
  let id;
  try {
    if (req.query && req.query.id) id = req.query.id;
    else {
      const url = req.url || "";
      const parts = url.split("/").filter(Boolean);
      const idx = parts.lastIndexOf("records");
      if (idx >= 0 && parts.length > idx + 1)
        id = parts
          .slice(idx + 1)
          .join("/")
          .split("?")[0];
      else if (parts.length) id = parts[parts.length - 1].split("?")[0];
    }
  } catch (e) {
    id = undefined;
  }
  if (id === "undefined" || id === "null" || id === "") id = undefined;

  const { db } = await connectToDatabase();
  const col = db.collection("trackings");

  // GET (unchanged)
  if (req.method === "GET") {
    const filters = [];
    try {
      if (ObjectId.isValid(id)) filters.push({ _id: new ObjectId(id) });
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

  // PATCH — accept new nested fields and recompute progressPct
  if (req.method === "PATCH") {
    if (!id)
      return res
        .status(400)
        .json({ error: "Missing id in request path or query" });

    // parse body robustly
    let bodyRaw = "";
    try {
      if (typeof req.body === "string") bodyRaw = req.body;
      else if (req.body && Object.keys(req.body).length)
        bodyRaw = JSON.stringify(req.body);
      else for await (const chunk of req) bodyRaw += chunk;
    } catch (e) {
      console.error("Error reading body:", e);
    }
    let body = {};
    try {
      body = bodyRaw ? JSON.parse(bodyRaw) : {};
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    // Allowed top-level and nested keys
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

    // origin and destination are nested — accept whole objects if provided
    if (body.origin !== undefined) {
      set.origin = body.origin;
    }
    if (body.destination !== undefined) {
      set.destination = body.destination;
    }

    // allow explicit currentIndex if admin wants to set it
    if (body.currentIndex !== undefined) {
      set.currentIndex = Number(body.currentIndex);
    }

    // if nothing to set, error
    if (Object.keys(set).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const now = new Date().toISOString();

    // We'll compute derived fields server-side:
    // - If destination changed and matches a route checkpoint by city, update currentIndex
    // - Compute progressPct from currentIndex & route if possible
    // - If status is Delivered, set progressPct = 100 and currentIndex = last

    // Build filter for findOneAndUpdate
    const orClauses = [];
    try {
      if (ObjectId.isValid(id)) orClauses.push({ _id: new ObjectId(id) });
    } catch (e) {}
    orClauses.push({ trackingId: id });

    // read current doc first (to compute derived changes)
    const rec = await col.findOne({ $or: orClauses });
    if (!rec) return res.status(404).json({ error: "Not found" });

    // Prepare updates
    const updateSet = { ...(set || {}) };
    updateSet.updatedAt = now;
    updateSet.lastUpdated = now;

    // If destination provided and has city, try match route city
    let newIndex = typeof rec.currentIndex === "number" ? rec.currentIndex : 0;
    if (body.destination && body.destination.city) {
      const city = body.destination.city;
      if (Array.isArray(rec.route)) {
        const match = rec.route.findIndex((r) =>
          r.city.toLowerCase().startsWith(city.toLowerCase())
        );
        if (match >= 0) newIndex = match;
      }
    }

    // If admin provided currentIndex explicitly, override
    if (
      body.currentIndex !== undefined &&
      Number.isFinite(Number(body.currentIndex))
    ) {
      newIndex = Number(body.currentIndex);
    }

    // If status explicitly set to Delivered, set index to last
    const totalStops = Array.isArray(rec.route) ? rec.route.length : 0;
    const lastIndex = totalStops > 0 ? totalStops - 1 : 0;
    if (body.status && String(body.status).toLowerCase() === "delivered") {
      newIndex = lastIndex;
      updateSet.status = "Delivered";
      updateSet.progressPct = 100;
    }

    // If we computed a newIndex different from existing, set it
    if (newIndex !== rec.currentIndex) {
      updateSet.currentIndex = newIndex;
      // update currentLocation to route[newIndex].location if exists
      if (Array.isArray(rec.route) && rec.route[newIndex]) {
        updateSet.currentLocation = rec.route[newIndex].location;
      }
    }

    // If progressPct not explicitly provided, compute from index/route
    if (body.progressPct === undefined) {
      if (totalStops > 1) {
        updateSet.progressPct = Math.round((newIndex / (totalStops - 1)) * 100);
      } else {
        updateSet.progressPct = rec.progressPct ?? 0;
      }
    }

    // If destination provides location, include it in history and set currentLocation
    const historyEntry = {};
    let pushHistory = false;
    if (body.destination) {
      const dest = body.destination;
      if (dest.location && dest.location.type === "Point") {
        updateSet.currentLocation = dest.location;
        historyEntry.location = dest.location;
        historyEntry.city =
          dest.address?.city || dest.city || rec.currentLocation?.city || null;
        historyEntry.note = "Admin updated destination location";
        pushHistory = true;
      } else if (dest.address && dest.address.city) {
        historyEntry.city = dest.address.city;
        historyEntry.note = "Admin updated destination city";
        pushHistory = true;
      } else if (body.destination.city) {
        historyEntry.city = body.destination.city;
        historyEntry.note = "Admin updated destination city";
        pushHistory = true;
      }
    }

    // If origin location provided, optionally push history note
    if (
      body.origin &&
      body.origin.location &&
      body.origin.location.type === "Point"
    ) {
      // optional: record sender location changes if needed; here we don't push history for origin by default
    }

    // Add updatedAt / lastUpdated to updateSet already done
    // Build update object
    const updateObj = { $set: updateSet };
    if (pushHistory) {
      const hist = {
        timestamp: now,
        city: historyEntry.city || null,
        location: historyEntry.location || rec.currentLocation || null,
        note: historyEntry.note || "Admin update",
        by: `admin`,
      };
      updateObj.$push = { locationHistory: hist };
    }

    // Perform atomic update
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

  // DELETE etc omitted for brevity (keep your existing implementation)
  if (req.method === "DELETE") {
    // ... your delete logic ...
    return res.status(204).end();
  }

  return res.status(405).json({ error: "Method not allowed" });
}
