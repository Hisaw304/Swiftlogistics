// /api/shared/mongo.js
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || "tracking_demo";

if (!uri) throw new Error("MONGODB_URI not set");

let cachedClient = global.__mongo_client__;
let cachedDb = global.__mongo_db__;

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(uri, {
    // keep pool small on M0; tune upward for larger clusters
    maxPoolSize: 10,
    // optionally set other options:
    // minPoolSize: 0,
    // serverSelectionTimeoutMS: 5000
  });

  await client.connect();
  const db = client.db(dbName);

  // cache on global so subsequent cold starts reuse client in same runtime
  global.__mongo_client__ = client;
  global.__mongo_db__ = db;

  return { client, db };
}
