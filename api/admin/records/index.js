// pages/api/admin/records/index.js
import { v4 as uuidv4 } from "uuid";
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

  if (req.method === "OPTIONS") return res.status(204).end();
  if (!ADMIN(req)) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const now = new Date().toISOString();
  const trackingId = body.trackingId || uuidv4();

  const doc = {
    trackingId,
    serviceType: body.serviceType || "standard",
    shipmentDetails: body.shipmentDetails || "",
    productDescription: body.productDescription || body.product || "",
    quantity: body.quantity ?? 1,
    weightKg: body.weightKg ?? null,
    description: body.description || "",
    origin: body.origin || null,
    destination: body.destination || null,
    shipmentDate: body.shipmentDate
      ? new Date(body.shipmentDate).toISOString()
      : null,
    expectedDeliveryDate: body.expectedDeliveryDate
      ? new Date(body.expectedDeliveryDate).toISOString()
      : body.destination?.expectedDeliveryDate || null,
    status: body.status || "Pending",
    route: body.route || [],
    currentIndex: 0,
    currentLocation:
      (body.origin && body.origin.location) ||
      (body.route && body.route[0] && body.route[0].location) ||
      null,
    progressPct: 0,
    locationHistory: [],
    createdAt: now,
    updatedAt: now,
    lastUpdated: now,
  };

  try {
    const { db } = await connectToDatabase();
    await db.collection("trackings").insertOne(doc);
    return res.status(201).json(doc);
  } catch (err) {
    console.error("Create record error:", String(err));
    return res
      .status(500)
      .json({ error: "create failed", detail: String(err) });
  }
}
