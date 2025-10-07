// /api/admin/records/index.js
import { connectToDatabase } from "../../_shared/mongo";
import { generateRoute } from "../../_shared/routeGenerator";

function requireAdmin(req) {
  const key = req.headers["x-admin-key"] || req.query.adminKey;
  return key && key === process.env.ADMIN_KEY;
}

function makeTrackingId(len = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < len; i++)
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  return `TRK-${s}`;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  if (!requireAdmin(req))
    return res.status(401).json({ error: "Unauthorized (admin key required)" });

  const { db } = await connectToDatabase();
  const col = db.collection("trackings");

  if (req.method === "GET") {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(200, parseInt(req.query.limit || "50", 10));
    const skip = (page - 1) * limit;
    const docs = await col
      .find({})
      .sort({ lastUpdated: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    return res.json({ items: docs, page });
  }

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const {
      customerName,
      address = {},
      product,
      quantity = 1,
      originWarehouse,
      destination,
      imageUrl,
      initialStatus,
    } = body;

    if (!product || !destination)
      return res
        .status(400)
        .json({ error: "product and destination required" });

    // generate unique trackingId
    let trackingId;
    for (let i = 0; i < 5; i++) {
      trackingId = makeTrackingId();
      const exists = await col.findOne({ trackingId });
      if (!exists) break;
      trackingId = null;
    }
    if (!trackingId)
      return res.status(500).json({ error: "Failed to generate trackingId" });

    const route = generateRoute(
      originWarehouse || "Los Angeles, CA",
      destination
    );
    const now = new Date();
    const doc = {
      trackingId,
      customerName: customerName || null,
      address: {
        full: address.full || null,
        street: address.street || null,
        city: address.city || null,
        state: address.state || null,
        zip: address.zip || null,
      },
      product,
      quantity,
      imageUrl: imageUrl || null,
      originWarehouse: originWarehouse || null,
      route,
      currentIndex: 0,
      currentLocation: route[0].location,
      locationHistory: [
        {
          timestamp: now.toISOString(),
          location: route[0].location,
          city: route[0].city,
          note: "Created",
        },
      ],
      status: initialStatus || "Pending",
      lastUpdated: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const r = await col.insertOne(doc);
    return res.status(201).json({ ...doc, _id: r.insertedId });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
