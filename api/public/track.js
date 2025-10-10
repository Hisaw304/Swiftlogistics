// pages/api/public/track.js
import { connectToDatabase } from "../shared/mongo.js";

/**
 * Public tracking endpoint
 * GET /api/public/track?trackingId=...
 *
 * Returns a safe public view of a tracking document.
 * By default we DO NOT expose recipient email. To expose (NOT recommended)
 * include ?exposePrivate=1 (you can lock this down later).
 */

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const trackingId = req.query.trackingId || req.query.id;
  if (!trackingId)
    return res.status(400).json({ error: "trackingId required" });

  const exposePrivate = req.query.exposePrivate === "1";

  try {
    const { db } = await connectToDatabase();
    const record = await db.collection("trackings").findOne({ trackingId });

    if (!record) return res.status(404).json({ error: "Not found" });

    // canonical route shaping: keep only needed fields
    const route = (record.route || []).map((r) => ({
      city: r.city,
      zip: r.zip,
      location: r.location,
      eta: r.eta,
    }));

    const currentIndex =
      typeof record.currentIndex === "number" ? record.currentIndex : 0;
    const progressPct =
      route.length > 1
        ? Math.round((currentIndex / (route.length - 1)) * 100)
        : 0;
    // -- add this before building the response --
    const shipmentDate =
      record.shipmentDate ||
      record.shippedAt ||
      record.shippedDate ||
      record.shipment_date ||
      null;
    // Build public response — include canonical fields you requested
    const response = {
      trackingId: record.trackingId,
      // shipment summary
      serviceType: record.serviceType || null,
      shipmentDetails: record.shipmentDetails || null,
      shipmentDate,
      productDescription: record.productDescription || record.product || null,
      quantity: record.quantity ?? 1,
      weightKg: record.weightKg ?? null,
      description: record.description || null,

      // origin (public)
      origin: record.origin
        ? {
            name: record.origin.name || null,
            address: {
              full: record.origin.address?.full || null,
              city: record.origin.address?.city || null,
              state: record.origin.address?.state || null,
              zip: record.origin.address?.zip || null,
            },
            location: record.origin.location || null,
          }
        : null,
      // fallback old originWarehouse for backward compatibility
      originWarehouse: record.originWarehouse || null,

      // destination (public view)
      destination: record.destination
        ? {
            receiverName:
              record.destination.receiverName || record.customerName || null,
            // receiverEmail is considered sensitive; only include if asked
            receiverEmail:
              record.destination.receiverEmail || record.customerEmail || null,
            address: {
              full:
                record.destination.address?.full ||
                record.address?.full ||
                null,
              city:
                record.destination.address?.city ||
                record.address?.city ||
                null,
              state:
                record.destination.address?.state ||
                record.address?.state ||
                null,
              zip:
                record.destination.address?.zip || record.address?.zip || null,
            },
            location: record.destination.location || null,
            expectedDeliveryDate:
              record.destination?.expectedDeliveryDate ||
              record.expectedDeliveryDate ||
              null,
          }
        : {
            receiverName: record.customerName || null,
            address: {
              full: record.address?.full || null,
              city: record.address?.city || null,
              state: record.address?.state || null,
              zip: record.address?.zip || null,
            },
            location: null,
            expectedDeliveryDate: record.expectedDeliveryDate || null,
          },

      // route/progress
      route,
      currentIndex,
      currentLocation:
        record.currentLocation || route[currentIndex]?.location || null,
      locationHistory: (record.locationHistory || []).map((h) => ({
        timestamp: h.timestamp,
        city: h.city,
        note: h.note,
      })),
      status: record.status || "Pending",
      lastUpdated:
        record.lastUpdated || record.updatedAt || record.createdAt || null,
      createdAt: record.createdAt || null,
      progressPct,
      imageUrl: record.imageUrl || null,
    };

    return res.json(response);
  } catch (err) {
    console.error("public/track error:", String(err));
    return res.status(500).json({ error: "Failed to fetch tracking" });
  }
}
