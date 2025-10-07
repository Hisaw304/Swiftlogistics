// src/components/ImageUploader.jsx
import React, { useState } from "react";
import {
  unsignedUploadUrl,
  unsignedPreset,
  cloudName,
  fetchSignedParams,
} from "../lib/cloudinary";

/*
  Props:
    - onUploadComplete(url: string | null)
    - initialUrl?: string
    - folder?: string (optional Cloudinary folder)
*/

export default function ImageUploader({
  onUploadComplete,
  initialUrl = null,
  folder,
}) {
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [manualUrl, setManualUrl] = useState("");

  async function doUnsignedUpload(file) {
    if (!unsignedPreset)
      throw new Error("VITE_CLOUDINARY_UPLOAD_PRESET not configured");
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", unsignedPreset);
    if (folder) form.append("folder", folder);

    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", unsignedUploadUrl());
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (!data.secure_url) return reject(new Error("Upload failed"));
            setUrl(data.secure_url);
            onUploadComplete && onUploadComplete(data.secure_url);
            setProgress(100);
            resolve();
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error("Upload network error"));
      xhr.send(form);
    });
  }

  async function doSignedUpload(file) {
    // fetch signature from server
    const signed = await fetchSignedParams(); // may throw
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", signed.apiKey);
    form.append("timestamp", signed.timestamp);
    form.append("signature", signed.signature);
    if (folder) form.append("folder", folder);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${
      signed.cloudName || cloudName
    }/auto/upload`;
    const resp = await fetch(uploadUrl, { method: "POST", body: form });
    const json = await resp.json();
    if (!resp.ok || !json.secure_url)
      throw new Error(json.error?.message || "Signed upload failed");
    setUrl(json.secure_url);
    onUploadComplete && onUploadComplete(json.secure_url);
    setProgress(100);
  }

  async function uploadFile(file) {
    setError(null);
    setProgress(0);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }
    setUploading(true);
    try {
      // Try signed first, then unsigned fallback
      try {
        await doSignedUpload(file);
      } catch (signedErr) {
        // signed might not be configured — fall back
        await doUnsignedUpload(file);
      }
    } catch (err) {
      console.error("Upload error", err);
      setError(err.message || "Upload failed");
      onUploadComplete && onUploadComplete(null);
    } finally {
      setUploading(false);
    }
  }

  function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    uploadFile(f);
  }

  function handleClear() {
    setUrl(null);
    setManualUrl("");
    setProgress(0);
    setError(null);
    onUploadComplete && onUploadComplete(null);
  }

  function handleUseUrl() {
    const v = manualUrl.trim();
    if (!v) {
      setError("Paste a valid image URL");
      return;
    }
    setUrl(v);
    onUploadComplete && onUploadComplete(v);
    setManualUrl("");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {url ? (
          <img
            src={url}
            alt="uploaded"
            className="w-20 h-20 object-cover rounded-md shadow-sm"
          />
        ) : (
          <div className="w-20 h-20 bg-gray-100 rounded-md flex items-center justify-center text-xs text-gray-400">
            no image
          </div>
        )}

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded cursor-pointer text-sm">
              <input
                type="file"
                accept="image/*"
                onChange={handleFile}
                className="hidden"
                disabled={uploading}
              />
              {uploading ? `Uploading ${progress}%` : "Choose Image"}
            </label>

            <button
              type="button"
              className="px-3 py-2 bg-white border rounded text-sm"
              onClick={handleClear}
              disabled={uploading && !url}
            >
              Clear
            </button>
          </div>

          <div className="text-xs text-gray-500 mt-2">
            {uploading ? (
              <div>Uploading: {progress}%</div>
            ) : (
              <div>Accepted: images. Uploads go to Cloudinary.</div>
            )}
            {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          className="flex-1 p-2 border rounded text-sm"
          placeholder="Or paste image URL"
          value={manualUrl}
          onChange={(e) => setManualUrl(e.target.value)}
        />
        <button
          className="px-3 py-2 bg-gray-100 rounded text-sm"
          onClick={handleUseUrl}
        >
          Use URL
        </button>
      </div>
    </div>
  );
}
