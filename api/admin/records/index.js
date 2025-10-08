// pages/api/admin/records/index.js
// pages/api/admin/records/index.js
import { connectToDatabase } from "../../shared/mongo.js";
import { randomUUID } from "crypto";
import { generateRoute } from "../../shared/routeGenerator.js";
import { ObjectId } from "mongodb"; // ✅ Add this line

const ADMIN = (req) => {
  const key = req.headers["x-admin-key"] || req.query?.adminKey;
  return key && key === process.env.ADMIN_KEY;
};

export default async function handler(req, res) {
  // === CORS setup ===
  const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "https://swiftlogistics-mu.vercel.app",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,x-admin-key",
  };

  // Preflight
  if (req.method === "OPTIONS") {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    // don't cache preflight
    res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    return res.status(204).end();
  }

  // Apply base headers
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");

  // Auth
  if (!ADMIN(req)) return res.status(401).json({ error: "Unauthorized" });

  const { db } = await connectToDatabase();
  const col = db.collection("trackings");

  // === GET: list with pagination ===
  if (req.method === "GET") {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(
      1,
      Math.min(1000, parseInt(req.query.limit || "100", 10))
    );
    const skip = (page - 1) * limit;

    try {
      const cursor = col
        .find({})
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
      const items = await cursor.toArray();
      const total = await col.countDocuments();
      return res.json({ items, total, page, limit });
    } catch (err) {
      console.error("List fetch error:", String(err));
      return res
        .status(500)
        .json({ error: "list failed", detail: String(err) });
    }
  }

  // === POST: create ===
  if (req.method === "POST") {
    // robust body parse
    let body = {};
    try {
      body =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const now = new Date().toISOString();
    const trackingId =
      (body.trackingId && String(body.trackingId).trim()) || randomUUID();

    // helpers
    const safeStr = (v) =>
      typeof v === "string" ? v.trim() || null : v ?? null;
    const toIso = (d) => {
      if (!d) return null;
      try {
        const dd = new Date(d);
        if (isNaN(dd.getTime())) return null;
        return dd.toISOString();
      } catch {
        return null;
      }
    };

    // build origin (allow nested or flat fields)
    const origin =
      body.origin ||
      (body.originName || body.originAddressFull
        ? {
            name: safeStr(body.originName) || null,
            address: {
              full: safeStr(body.originAddressFull) || null,
              city: safeStr(body.originCity) || null,
              state: safeStr(body.originState) || null,
              zip: safeStr(body.originZip) || null,
            },
            location:
              body.origin?.location ||
              (body.originLat && body.originLng
                ? {
                    type: "Point",
                    coordinates: [
                      Number(body.originLng),
                      Number(body.originLat),
                    ],
                  }
                : null),
          }
        : null);

    // build destination (nested or flat)
    const destination =
      body.destination ||
      (body.receiverName || body.destAddressFull || body.receiverEmail
        ? {
            receiverName:
              safeStr(body.receiverName) || safeStr(body.customerName) || null,
            receiverEmail:
              safeStr(body.receiverEmail) ||
              safeStr(body.customerEmail) ||
              null,
            address: {
              full: safeStr(body.destAddressFull) || null,
              city: safeStr(body.destCity) || null,
              state: safeStr(body.destState) || null,
              zip: safeStr(body.destZip) || null,
            },
            location:
              body.destination?.location ||
              (body.destLat && body.destLng
                ? {
                    type: "Point",
                    coordinates: [Number(body.destLng), Number(body.destLat)],
                  }
                : null),
            expectedDeliveryDate:
              toIso(body.destExpectedDeliveryDate) ||
              toIso(body.expectedDeliveryDate) ||
              null,
          }
        : null);

    // back-compat top-level address
    const address = (() => {
      if (body.address && typeof body.address === "object") {
        return {
          full: safeStr(body.address.full) || null,
          city: safeStr(body.address.city) || null,
          state: safeStr(body.address.state) || null,
          zip: safeStr(body.address.zip) || null,
        };
      }
      if (body.addressFull || body.city || body.state || body.zip) {
        return {
          full: safeStr(body.addressFull) || null,
          city: safeStr(body.city) || null,
          state: safeStr(body.state) || null,
          zip: safeStr(body.zip) || null,
        };
      }
      return null;
    })();

    // route: prefer provided route, otherwise generate
    let route =
      Array.isArray(body.route) && body.route.length ? body.route : null;
    const originLabel =
      (origin && origin.address && origin.address.city) ||
      body.originWarehouse ||
      "Los Angeles, CA";
    const destLabel =
      (destination && destination.address && destination.address.city) ||
      body.destinationCity ||
      body.destination ||
      body.destCity ||
      "Austin, TX";

    if (!route) {
      try {
        route = generateRoute(originLabel, destLabel);
      } catch (e) {
        console.warn("route generation failed:", String(e));
        route = [];
      }
    }

    // currentIndex, default 0
    let currentIndex = Number.isFinite(Number(body.currentIndex))
      ? Number(body.currentIndex)
      : 0;
    currentIndex = Math.max(0, currentIndex);

    // compute currentLocation from provided, origin, or route
    const currentLocation =
      body.currentLocation && body.currentLocation.type === "Point"
        ? body.currentLocation
        : route && route[currentIndex] && route[currentIndex].location
        ? route[currentIndex].location
        : origin && origin.location
        ? origin.location
        : null;

    // compute progress
    const totalStops = Array.isArray(route) ? route.length : 0;
    let progressPct =
      totalStops > 1 ? Math.round((currentIndex / (totalStops - 1)) * 100) : 0;

    // normalize dates
    const shipmentDateIso = toIso(body.shipmentDate) || null;
    const expectedDeliveryIso =
      toIso(body.expectedDeliveryDate) ||
      destination?.expectedDeliveryDate ||
      null;

    // status auto-rules
    const statusRaw =
      safeStr(body.status) || safeStr(body.initialStatus) || "Pending";
    const status = String(statusRaw).trim();

    // If status is Shipped and there is no shipmentDate, set it to now
    const computedShipmentDate =
      status.toLowerCase() === "shipped"
        ? shipmentDateIso || now
        : shipmentDateIso;

    // If delivered — set progress to 100 and currentIndex to last
    if (status.toLowerCase() === "delivered") {
      if (Array.isArray(route) && route.length > 0) {
        currentIndex = Math.max(0, route.length - 1);
      }
      progressPct = 100;
    } else {
      // recompute progress normally if not delivered
      if (totalStops > 1) {
        progressPct = Math.round((currentIndex / (totalStops - 1)) * 100);
      } else {
        progressPct = progressPct ?? 0;
      }
    }

    // build the document
    const doc = {
      trackingId,
      // shipment summary
      serviceType: safeStr(body.serviceType) || "standard",
      shipmentDetails: safeStr(body.shipmentDetails) || "",
      productDescription:
        safeStr(body.productDescription) || safeStr(body.product) || null,
      product: safeStr(body.product) || null,
      quantity: Number.isFinite(Number(body.quantity))
        ? Number(body.quantity)
        : 1,
      weightKg: Number.isFinite(Number(body.weightKg))
        ? Number(body.weightKg)
        : null,
      description: safeStr(body.description) || null,

      // parties & addresses
      origin: origin || null,
      destination: destination || null,
      address: address || null,
      originWarehouse:
        safeStr(body.originWarehouse) ||
        (origin && origin.address && origin.address.city) ||
        null,

      // route / progress
      route,
      currentIndex,
      currentLocation,
      progressPct,

      // dates
      shipmentDate: computedShipmentDate || null,
      expectedDeliveryDate: expectedDeliveryIso || null,

      // status & history
      status,
      locationHistory: Array.isArray(body.locationHistory)
        ? body.locationHistory
        : [],

      // metadata
      createdAt: now,
      updatedAt: now,
      lastUpdated: now,
      updatedBy: safeStr(body.updatedBy) || null,
    };

    try {
      await col.insertOne(doc);
      return res.status(201).json(doc);
    } catch (err) {
      console.error("Create record error:", String(err));
      return res
        .status(500)
        .json({ error: "create failed", detail: String(err) });
    }
  }
  if (req.method === "PATCH") {
    let body = {};
    try {
      body =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const { trackingId, updates } = body;

    if (!trackingId) {
      return res.status(400).json({ error: "trackingId required" });
    }

    const now = new Date();

    // build a safe query for either trackingId or _id
    let query = { $or: [{ trackingId }] };
    try {
      query.$or.push({ _id: new ObjectId(trackingId) });
    } catch {
      // ignore invalid ObjectId
    }

    try {
      const result = await col.findOneAndUpdate(
        query,
        {
          $set: {
            ...(typeof updates === "object" ? updates : {}),
            updatedAt: now,
            lastUpdated: now,
          },
        },
        { returnDocument: "after" }
      );

      if (!result.value) {
        return res.status(404).json({ error: "Record not found" });
      }

      return res.status(200).json({
        message: "Record updated successfully",
        updatedRecord: result.value,
      });
    } catch (err) {
      console.error("PATCH error:", err);
      return res
        .status(500)
        .json({ error: "Update failed", detail: String(err) });
    }
  }

  // fallback for other methods
  return res.status(405).json({ error: "Method not allowed" });
}
