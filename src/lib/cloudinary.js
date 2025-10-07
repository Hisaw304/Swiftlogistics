// src/lib/cloudinary.js
export const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";
export const unsignedPreset =
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "";

export function unsignedUploadUrl() {
  if (!cloudName) throw new Error("VITE_CLOUDINARY_CLOUD_NAME not set");
  return `https://api.cloudinary.com/v1_1/${cloudName}/upload`;
}

// Optional: call your serverless signature endpoint to get timestamp+signature
export async function fetchSignedParams() {
  const res = await fetch("/api/upload/sign");
  if (!res.ok) throw new Error("Failed to get upload signature");
  return res.json();
}
