// /api/admin/records/index.js
import { connectToDatabase } from "../../shared/mongo.js";
import { randomUUID } from "crypto";
import { generateRoute } from "../../shared/routeGenerator.js";

const ADMIN = (req) => {
  const key = req.headers["x-admin-key"] || req.query.adminKey;
  return key && key === process.env.ADMIN_KEY;
};

export default async function handler(req, res) {
  // === CORS setup ===
  const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "https://swiftlogistics-mu.vercel.app",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,x-admin-key",
  };

  // Respond to preflight
  if (req.method === "OPTIONS") {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(204).end();
  }

  // Apply headers to all other responses
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  res.setHeader("Content-Type", "application/json");

  // === Auth check ===
  if (!ADMIN(req)) return res.status(401).json({ error: "Unauthorized" });

  const { db } = await connectToDatabase();
  const col = db.collection("trackings");

  if (req.method === "GET") {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "100", 10);
    const skip = (page - 1) * limit;

    const cursor = col.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit);
    const items = await cursor.toArray();
    const total = await col.countDocuments();

    return res.json({ items, total, page, limit });
  }

  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const now = new Date().toISOString();
    const trackingId = body.trackingId || randomUUID();

    const doc = {
      trackingId,
      customerName: body.customerName?.trim() || "Unknown Recipient",
      address: {
        full:
          (typeof body.address === "object"
            ? body.address.full?.trim()
            : body.addressFull?.trim() || body.address?.trim()) ||
          "Unknown Address",
        city:
          body.city?.trim() ||
          (typeof body.address === "object" ? body.address.city?.trim() : "") ||
          "Unknown City",
        state:
          body.state?.trim() ||
          (typeof body.address === "object"
            ? body.address.state?.trim()
            : "") ||
          "Texas",
        zip:
          body.zip?.trim() ||
          (typeof body.address === "object" ? body.address.zip?.trim() : "") ||
          "",
      },
      product: body.product?.trim() || "Unknown Product",
      quantity: body.quantity ?? 1,
      imageUrl: body.imageUrl || null,
      status: body.initialStatus || "Pending",
      originWarehouse: body.originWarehouse?.trim() || "Los Angeles, CA",
      route: generateRoute(
        body.originWarehouse || "Los Angeles, CA",
        body.destination || "Austin, TX"
      ),
      currentIndex: 0,
      locationHistory: [],
      createdAt: now,
      lastUpdated: now,
    };

    await col.insertOne(doc);
    return res.status(201).json(doc);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
