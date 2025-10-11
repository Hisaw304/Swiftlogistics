// pages/api/admin/records/index.js
import { connectToDatabase } from "../../shared/mongo.js";

import { generateRoute } from "./routeGenerator.js";
import { ObjectId } from "mongodb";

/**
 * Simple admin check (same as your original)
 */
const ADMIN = (req) => {
  const key = req.headers["x-admin-key"] || req.query?.adminKey;
  return key && key === process.env.ADMIN_KEY;
};

export default async function handler(req, res) {
  // TEMP: debug env presence (DO NOT log secrets in production)
  console.log("ENV_CHECK:", {
    node_env: process.env.NODE_ENV || null,
    has_mongo_uri: !!process.env.MONGODB_URI,
    has_admin_key: !!process.env.ADMIN_KEY,
    has_ors_key: !!process.env.ORS_API_KEY,
  });

  try {
    // === CORS setup ===
    // NOTE: for debugging this is permissive. Replace '*' with your origin when done.
    const CORS_HEADERS = {
      "Access-Control-Allow-Origin": "https://swiftlogistics-mu.vercel.app",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,x-admin-key",
    };

    // Preflight
    if (req.method === "OPTIONS") {
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
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

    // Connect to DB with its own try/catch (so we can log cleanly)
    let dbConn;
    try {
      dbConn = await connectToDatabase();
    } catch (dbErr) {
      console.error(
        "DB connection failed:",
        dbErr && dbErr.stack ? dbErr.stack : String(dbErr)
      );
      return res
        .status(500)
        .json({ error: "Database connection failed", detail: String(dbErr) });
    }

    const { db } = dbConn;
    const col = db.collection("trackings");

    // === GET: list with pagination ===
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
        let items = await cursor.toArray();
        // normalize _id to string for client consistency
        items = items.map((it) => ({
          ...it,
          _id:
            it._id && typeof it._id !== "string" ? it._id.toString() : it._id,
        }));
        const total = await col.countDocuments();
        return res.json({ items, total, page, limit });
      } catch (err) {
        console.error(
          "List fetch error:",
          err && err.stack ? err.stack : String(err)
        );
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
      function generateTrackingId() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let id = "";
        for (let i = 0; i < 12; i++) {
          id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
      }

      const trackingId =
        (body.trackingId && String(body.trackingId).trim()) ||
        generateTrackingId();

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
                safeStr(body.receiverName) ||
                safeStr(body.customerName) ||
                null,
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
          // If generateRoute requires an API key, make sure it's present
          if (!process.env.ORS_API_KEY) {
            console.warn(
              "ORS_API_KEY not set — skipping live route generation, using empty route."
            );
            route = [];
          } else {
            // call generateRoute in a guarded way and ensure it returns an array
            try {
              // If your generateRoute is async this will await; if it's sync it will still work.
              const maybeRoute = await generateRoute(
                {
                  lat: origin?.location?.coordinates?.[1],
                  lng: origin?.location?.coordinates?.[0],
                  city: origin?.address?.city || originLabel,
                },
                {
                  lat: destination?.location?.coordinates?.[1],
                  lng: destination?.location?.coordinates?.[0],
                  city: destination?.address?.city || destLabel,
                }
              );
              route = Array.isArray(maybeRoute) ? maybeRoute : [];
            } catch (e) {
              console.warn(
                "generateRoute threw, falling back to empty route:",
                String(e)
              );
              route = [];
            }
          }
        } catch (e) {
          console.warn(
            "Unexpected error while attempting route generation:",
            String(e)
          );
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
        totalStops > 1
          ? Math.round((currentIndex / (totalStops - 1)) * 100)
          : 0;

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
        origin: origin || null,
        destination: destination || null,
        address: address || null,
        originWarehouse:
          safeStr(body.originWarehouse) ||
          (origin && origin.address && origin.address.city) ||
          null,
        route,
        currentIndex,
        currentLocation,
        progressPct,
        shipmentDate: computedShipmentDate || null,
        expectedDeliveryDate: expectedDeliveryIso || null,
        status,
        locationHistory: Array.isArray(body.locationHistory)
          ? body.locationHistory
          : [],
        imageUrl: safeStr(body.imageUrl) || safeStr(body.image) || null,
        image: safeStr(body.image) || safeStr(body.imageUrl) || null,
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

    // === PATCH ===
    // === PATCH ===
    if (req.method === "PATCH") {
      let body = {};
      try {
        body =
          typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      } catch {
        return res.status(400).json({ error: "Invalid JSON body" });
      }

      const { trackingId, updates } = body;

      const trackingIdRaw = trackingId ? String(trackingId).trim() : null;
      console.log(
        "PATCH /api/admin/records called. trackingId:",
        trackingIdRaw,
        "updates:",
        updates
      );

      if (!trackingIdRaw) {
        return res.status(400).json({ error: "trackingId required" });
      }

      const now = new Date();

      // build a tolerant query: exact trackingId, case-insensitive trackingId, or ObjectId
      const orClauses = [];
      orClauses.push({ trackingId: trackingIdRaw });
      // Escape regex specials in trackingIdRaw for safe regex use
      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      orClauses.push({
        trackingId: {
          $regex: `^${escapeRegex(trackingIdRaw)}$`,
          $options: "i",
        },
      });
      try {
        if (ObjectId.isValid(trackingIdRaw)) {
          orClauses.push({ _id: new ObjectId(trackingIdRaw) });
        }
      } catch {
        /* ignore */
      }

      const query = { $or: orClauses };

      try {
        // Fetch existing doc to recompute derived fields reliably
        const existing = await col.findOne(query);
        if (!existing) {
          console.log(
            "PATCH: no document matched query:",
            JSON.stringify(query)
          );
          return res.status(404).json({ error: "Record not found" });
        }

        // Prepare updates object safely
        const updatesObj =
          typeof updates === "object" && updates ? updates : {};

        // Merge route/currentIndex/status from updates or existing for recompute
        const route = Array.isArray(updatesObj.route)
          ? updatesObj.route
          : Array.isArray(existing.route)
          ? existing.route
          : [];

        let currentIndex = Number.isFinite(Number(updatesObj.currentIndex))
          ? Number(updatesObj.currentIndex)
          : Number.isFinite(Number(existing.currentIndex))
          ? Number(existing.currentIndex)
          : 0;
        currentIndex = Math.max(0, currentIndex);

        const totalStops = Array.isArray(route) ? route.length : 0;
        let progressPct =
          totalStops > 1
            ? Math.round((currentIndex / (totalStops - 1)) * 100)
            : 0;

        // Status handling: prefer updated status, then existing
        const statusRaw =
          (updatesObj.status && String(updatesObj.status)) ||
          existing.status ||
          "Pending";
        const status = String(statusRaw).trim();

        // Shipment date handling
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
        const shipmentDateIso = updatesObj.shipmentDate
          ? toIso(updatesObj.shipmentDate)
          : existing.shipmentDate || null;

        // If status becomes "Shipped" and no shipmentDate, set to now
        const computedShipmentDate =
          status.toLowerCase() === "shipped"
            ? shipmentDateIso || now.toISOString()
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

        // compute currentLocation: prefer updates, fall back to route/current/origin in existing doc
        const currentLocation =
          updatesObj.currentLocation &&
          updatesObj.currentLocation.type === "Point"
            ? updatesObj.currentLocation
            : route && route[currentIndex] && route[currentIndex].location
            ? route[currentIndex].location
            : existing.origin && existing.origin.location
            ? existing.origin.location
            : null;

        // Build final $set updates: include derived fields
        const finalUpdates = {
          ...(updatesObj || {}),
          currentIndex,
          currentLocation,
          progressPct,
          status,
          shipmentDate: computedShipmentDate || null,
          updatedAt: now,
          lastUpdated: now,
        };

        const result = await col.findOneAndUpdate(
          query,
          {
            $set: finalUpdates,
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
        console.error(
          "PATCH error:",
          err && err.stack ? err.stack : String(err)
        );
        return res
          .status(500)
          .json({ error: "Update failed", detail: String(err) });
      }
    }

    // === DELETE: remove a record by trackingId or _id ===
    // -------------------- DELETE --------------------
    if (req.method === "DELETE") {
      const idParam = id || (req.query && req.query.id) || null;
      if (!idParam) {
        return res.status(400).json({ error: "Missing id in path or query" });
      }

      console.log("[DELETE] resolved idParam:", idParam);

      const orClauses = [{ trackingId: String(idParam) }];
      try {
        if (ObjectId.isValid(String(idParam))) {
          orClauses.push({ _id: new ObjectId(String(idParam)) });
        }
      } catch (e) {}
      // case-insensitive trackingId fallback
      const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      orClauses.push({
        trackingId: {
          $regex: `^${escapeRegex(String(idParam))}$`,
          $options: "i",
        },
      });

      try {
        const result = await col.findOneAndDelete({ $or: orClauses });
        if (!result.value) {
          console.log("[DELETE] no document matched:", orClauses);
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

    // fallback for other methods
    return res.status(405).json({ error: "Method not allowed" });
  } catch (unhandledErr) {
    // Catch any error not previously caught above
    console.error(
      "Unhandled API error:",
      unhandledErr && unhandledErr.stack
        ? unhandledErr.stack
        : String(unhandledErr)
    );
    return res
      .status(500)
      .json({ error: "Internal server error", detail: String(unhandledErr) });
  }
}
