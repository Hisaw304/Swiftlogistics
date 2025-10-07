// /api/upload/sign.js
import crypto from "crypto";

export default async function handler(req, res) {
  // simple signed timestamp signature for client upload
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!apiSecret || !apiKey || !cloudName)
    return res.status(500).json({ error: "Cloudinary not configured" });

  const timestamp = Math.floor(Date.now() / 1000);
  // signature for only timestamp param: sha1("timestamp=<timestamp><api_secret>")
  const toSign = `timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(toSign).digest("hex");
  return res.json({ apiKey, cloudName, timestamp, signature });
}
