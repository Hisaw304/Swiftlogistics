import { connectToDatabase } from "../../shared/mongo.js";
import { randomUUID } from "crypto";
import { generateRoute } from "./routeGenerator.js";
import { ObjectId } from "mongodb"; // ✅ Add this line

const ADMIN = (req) => {
  const key = req.headers["x-admin-key"] || req.query?.adminKey;
  return key && key === process.env.ADMIN_KEY;
};

export default async function handler(req, res) {
  // TEMP: debug env presence (DO NOT log secrets)
  console.log("ENV_CHECK:", {
    node_env: process.env.NODE_ENV || null,
    has_mongo_uri: !!process.env.MONGODB_URI,
    has_admin_key: !!process.env.ADMIN_KEY,
    has_ors_key: !!process.env.ORS_API_KEY,
  });

  // === wrap whole handler so unexpected throws return JSON and log stack ===
  try {
    // === CORS setup ===
    // For debugging you can set origin to '*' then lock it down after verified
    const CORS_HEADERS = {
      "Access-Control-Allow-Origin": "*", // <-- temporarily permissive for debugging
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
      const conn = await connectToDatabase();
      dbConn = conn;
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

    // ROUTES: keep the rest of your code exactly the same...
    // === GET: list with pagination ===
    if (req.method === "GET") {
      // your GET code unchanged
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
      const trackingId =
        (body.trackingId && String(body.trackingId).trim()) || randomUUID();

      // helpers (same as you had)
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

      // build origin/destination/address (same code omitted here for brevity)
      // I'll keep the original code block unchanged — copy your original blocks in here.
      // ...
      // For brevity in this snippet, assume you paste the rest of your original POST code
      // starting from building `origin`, `destination`, `address`, and onwards.

      // IMPORTANT: wrap generateRoute in a try/catch and log its input & errors
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
          const genInputOrigin = {
            lat: origin?.location?.coordinates?.[1],
            lng: origin?.location?.coordinates?.[0],
            city: origin?.address?.city || originLabel,
          };
          const genInputDest = {
            lat: destination?.location?.coordinates?.[1],
            lng: destination?.location?.coordinates?.[0],
            city: destination?.address?.city || destLabel,
          };
          console.log("generateRoute inputs:", genInputOrigin, genInputDest);
          route = await generateRoute(genInputOrigin, genInputDest);
          console.log(
            "generateRoute returned length:",
            Array.isArray(route) ? route.length : typeof route
          );
        } catch (e) {
          console.warn(
            "route generation failed:",
            e && e.stack ? e.stack : String(e)
          );
          route = [];
        }
      }

      // ... continue with rest of your POST code to compute currentIndex/currentLocation/doc and insert
      try {
        // build final `doc` exactly as you currently do and insert
        // (paste your existing doc creation and insertOne code here)
      } catch (err) {
        console.error(
          "Create record error:",
          err && err.stack ? err.stack : String(err)
        );
        return res
          .status(500)
          .json({ error: "create failed", detail: String(err) });
      }
    }

    // === PATCH, DELETE and fallback ===
    // Keep these blocks unchanged but they are already inside the top-level try/catch,
    // so unexpected throws will be caught and logged below.

    // Paste your PATCH and DELETE blocks here exactly as they were.

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
    // Return a safe JSON error so the platform doesn't return a generic FUNCTION_INVOCATION_FAILED
    return res
      .status(500)
      .json({ error: "Internal server error", detail: String(unhandledErr) });
  }
}
