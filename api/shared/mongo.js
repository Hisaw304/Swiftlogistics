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

  console.log("MongoDB: creating new client connection (cold start)");
  const client = new MongoClient(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
  });

  await client.connect();
  const db = client.db(dbName);

  global.__mongo_client__ = client;
  global.__mongo_db__ = db;

  return { client, db };
}
