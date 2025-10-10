// /api/shared/mongo.js
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || "tracking_demo";

if (!uri) throw new Error("MONGODB_URI not set");

let cached = global._mongo; // reuse across lambda invocations
if (!cached) cached = global._mongo = { conn: null, client: null };

export async function connectToDatabase() {
  if (cached.conn) return cached.conn;
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await client.connect();
  const db = client.db(dbName);
  cached.conn = { client, db };
  return cached.conn;
}
