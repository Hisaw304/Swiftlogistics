// src/components/ImageUploader.jsx
import React, { useState } from "react";

/*
  Usage:
    <ImageUploader onUploadComplete={(url) => {...}} />
  Requires env vars at build-time (Vite):
    VITE_CLOUDINARY_CLOUD_NAME
    VITE_CLOUDINARY_UPLOAD_PRESET
  If not set, the component will prompt admin to paste cloud name + preset.
*/

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "";

export default function ImageUploader({ onUploadComplete, initialUrl = null }) {
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState(null);
  const [cloudName, setCloudName] = useState(CLOUD_NAME);
  const [preset, setPreset] = useState(UPLOAD_PRESET);

  async function uploadFile(file) {
    setError(null);
    if (!cloudName || !preset) {
      setError(
        "Cloudinary info missing. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET or paste below."
      );
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("upload_preset", preset);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
        {
          method: "POST",
          body: form,
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Upload failed");
      setUrl(json.secure_url);
      onUploadComplete && onUploadComplete(json.secure_url);
    } catch (err) {
      setError(err.message || "Upload error");
    } finally {
      setUploading(false);
    }
  }

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    uploadFile(f);
  }

  return (
    <div className="space-y-2">
      {url ? (
        <div className="flex items-center gap-3">
          <img
            src={url}
            alt="uploaded"
            className="w-20 h-20 object-cover rounded-md shadow-sm"
          />
          <div className="text-sm text-gray-600 break-all">{url}</div>
        </div>
      ) : (
        <div className="text-sm text-gray-500">No image uploaded</div>
      )}

      <div className="flex items-center gap-2">
        <label className="inline-flex items-center px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer text-sm">
          <input
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
            disabled={uploading}
          />
          {uploading ? "Uploading..." : "Choose Image"}
        </label>

        <button
          type="button"
          className="px-3 py-2 bg-white border rounded text-sm"
          onClick={() => {
            setUrl(null);
            onUploadComplete && onUploadComplete(null);
          }}
        >
          Clear
        </button>
      </div>

      {!cloudName || !preset ? (
        <div className="text-xs text-yellow-700">
          <div>Cloudinary not set. Paste details to enable direct uploads:</div>
          <input
            className="mt-1 px-2 py-1 border rounded w-full"
            placeholder="cloud name"
            value={cloudName}
            onChange={(e) => setCloudName(e.target.value)}
          />
          <input
            className="mt-1 px-2 py-1 border rounded w-full"
            placeholder="upload preset"
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
          />
        </div>
      ) : null}

      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}
