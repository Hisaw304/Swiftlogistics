import React from "react";
import ProgressBar from "./ProgressBar";

export default function TrackingModal({ record, onClose }) {
  if (!record) return null;
  const route = Array.isArray(record.route) ? record.route : [];
  const idx = typeof record.currentIndex === "number" ? record.currentIndex : 0;

  // prefer server progressPct
  const progress =
    typeof record.progressPct === "number" && !Number.isNaN(record.progressPct)
      ? Math.max(0, Math.min(100, Math.round(record.progressPct)))
      : route.length > 1
      ? Math.round((idx / (route.length - 1)) * 100)
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white max-w-2xl w-full p-4 rounded shadow">
        <div className="flex justify-between items-start">
          <h3 className="font-semibold">Tracking {record.trackingId}</h3>
          <button onClick={onClose} className="text-sm text-gray-600">
            Close
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
          <img
            src={record.imageUrl || "/assets/img_4775.png"}
            alt="product"
            className="w-full md:w-36 h-36 object-cover rounded"
          />
          <div className="md:col-span-2">
            <div className="text-sm text-gray-700">{record.product}</div>
            <div className="text-xs text-gray-400 mt-1">
              Status: {record.status}
            </div>
            <div className="mt-3">
              <ProgressBar
                progress={progress}
                status={record.status}
                showLabel
              />
              <div className="text-xs text-gray-500 mt-1">
                {progress}% — Checkpoint {Math.min(idx + 1, route.length)} of{" "}
                {route.length}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h4 className="font-medium text-sm">Recent history</h4>
          <ul className="mt-2 text-xs text-gray-600 space-y-2">
            {(record.locationHistory || [])
              .slice(-5)
              .reverse()
              .map((h, i) => (
                <li key={i} className="flex justify-between">
                  <div>
                    {h.city || "Update"} {h.note ? `— ${h.note}` : ""}
                  </div>
                  <div className="text-gray-400">
                    {h.timestamp ? new Date(h.timestamp).toLocaleString() : "—"}
                  </div>
                </li>
              ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
