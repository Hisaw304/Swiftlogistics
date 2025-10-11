// pages/api/admin/records/[id]/next.js
import { ObjectId } from "mongodb";
import { connectToDatabase } from "../../../shared/mongo.js";

function requireAdmin(req) {
  const key = req.headers["x-admin-key"] || req.query?.adminKey;
  return key && key === process.env.ADMIN_KEY;
}

export default async function handler(req, res) {
  // CORS for this endpoint (match your admin origin)
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://swiftlogistics-mu.vercel.app"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-admin-key");
  res.setHeader("Content-Type", "application/json");
  if (req.method === "OPTIONS") return res.status(204).end();

  console.log("NEXT handler hit:", {
    method: req.method,
    url: req.url,
    headers: { "x-admin-key": req.headers["x-admin-key"] },
  });

  if (!requireAdmin(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Resolve id param directly from req.query.id (Next dynamic route)
  // inside api/admin/records/[id]/next.js

  // Resolve id param manually if missing
  const id =
    req.query?.id || req.url.split("/").filter(Boolean).slice(-2, -1)[0];

  if (!id) {
    return res.status(400).json({ error: "Missing id param" });
  }

  let conn;
  try {
    conn = await connectToDatabase();
  } catch (err) {
    console.error(
      "DB connect failed:",
      err && err.stack ? err.stack : String(err)
    );
    return res
      .status(500)
      .json({ error: "DB connect failed", detail: String(err) });
  }
  const db = conn.db || conn;
  const col = db.collection("trackings");

  try {
    const filter = ObjectId.isValid(id)
      ? { _id: new ObjectId(id) }
      : { trackingId: id };
    const rec = await col.findOne(filter);
    if (!rec) return res.status(404).json({ error: "Not found" });

    const currentIndex = Number.isFinite(Number(rec.currentIndex))
      ? Number(rec.currentIndex)
      : 0;
    const lastIndex = (rec.route || []).length - 1;

    if (currentIndex >= lastIndex) {
      return res.status(400).json({ error: "Already at final checkpoint" });
    }

    const newIndex = currentIndex + 1;
    const checkpoint = (rec.route || [])[newIndex] || null;
    const now = new Date().toISOString();

    const historyEntry = {
      timestamp: now,
      location: checkpoint ? checkpoint.location : rec.currentLocation || null,
      city: checkpoint ? checkpoint.city : null,
      note: "Arrived checkpoint",
      by: "admin",
    };

    const newStatus =
      newIndex === lastIndex
        ? "Delivered"
        : rec.status === "Pending"
        ? "Shipped"
        : rec.status;

    await col.updateOne(filter, {
      $set: {
        currentIndex: newIndex,
        currentLocation: checkpoint
          ? checkpoint.location
          : rec.currentLocation || null,
        status: newStatus,
        updatedAt: now,
        lastUpdated: now,
      },
      $push: { locationHistory: historyEntry },
    });

    const updated = await col.findOne(filter);
    if (updated._id && typeof updated._id !== "string")
      updated._id = updated._id.toString();
    return res.status(200).json(updated);
  } catch (err) {
    console.error(
      "NEXT handler error:",
      err && err.stack ? err.stack : String(err)
    );
    return res
      .status(500)
      .json({ error: "Internal error", detail: String(err) });
  }
}
