import React from "react";
import ProgressBar from "./ProgressBar";

function formatTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

// small helper local to this file to ensure id is a string
function idToString(id, trackingId) {
  try {
    if (id == null) return trackingId || "";
    return typeof id === "object" && typeof id.toString === "function"
      ? id.toString()
      : String(id);
  } catch {
    return trackingId || String(id);
  }
}

// compute fallback progress from route/currentIndex
function computeProgressFromRoute(r) {
  const routeLen = Array.isArray(r?.route) ? r.route.length : 0;
  const idx = typeof r?.currentIndex === "number" ? r.currentIndex : 0;
  if (routeLen > 1) return Math.round((idx / (routeLen - 1)) * 100);
  // fallback mapping from status if no route
  const s = (r?.status || "").toLowerCase();
  if (s === "delivered") return 100;
  if (s === "out for delivery") return 85;
  if (s === "shipped") return 50;
  if (s === "on hold") return 10;
  return 0;
}

export default function RecordsTable({
  records = [],
  onNext,
  onEdit,
  onDelete,
}) {
  return (
    <div className="bg-white shadow rounded overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left">Tracking</th>
            <th className="px-3 py-2 text-left">Customer</th>
            <th className="px-3 py-2 text-left">Product</th>
            <th className="px-3 py-2 text-left">Current City</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Last Updated</th>
            <th className="px-3 py-2 text-left">Thumb</th>
            <th className="px-3 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => {
            const currentCity =
              r.route &&
              typeof r.currentIndex === "number" &&
              r.route[r.currentIndex]
                ? r.route[r.currentIndex].city
                : "—";

            // Prefer server-provided progressPct; fallback to compute
            const progress =
              typeof r.progressPct === "number" && !Number.isNaN(r.progressPct)
                ? Math.max(0, Math.min(100, Math.round(r.progressPct)))
                : computeProgressFromRoute(r);

            const key = idToString(r._id, r.trackingId);
            const idString = key; // normalized string id used by buttons

            const atFinal =
              Array.isArray(r.route) && r.route.length > 0
                ? (r.currentIndex ?? 0) >= r.route.length - 1
                : false;

            return (
              <tr key={key} className="border-t">
                <td className="px-3 py-2 align-top">
                  <div className="font-mono text-xs">{r.trackingId}</div>
                </td>
                <td className="px-3 py-2 align-top">{r.customerName || "—"}</td>
                <td className="px-3 py-2 align-top">{r.product}</td>
                <td className="px-3 py-2 align-top">{currentCity}</td>
                <td className="px-3 py-2 align-top">
                  <div>{r.status}</div>
                  <div className="text-xs text-gray-400">{progress}%</div>
                  <div className="mt-2">
                    <ProgressBar progress={progress} status={r.status} />
                  </div>
                </td>
                <td className="px-3 py-2 align-top text-xs text-gray-500">
                  {formatTime(r.lastUpdated)}
                </td>
                <td className="px-3 py-2 align-top">
                  {r.imageUrl ? (
                    <img
                      src={r.imageUrl}
                      alt="thumb"
                      className="w-12 h-12 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-400">
                      no image
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 align-top space-x-2">
                  <button
                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded disabled:opacity-50"
                    onClick={() => onNext && onNext(idString)}
                    disabled={atFinal}
                    title={
                      atFinal
                        ? "Already at final checkpoint"
                        : "Advance to next checkpoint"
                    }
                  >
                    Next Stop
                  </button>
                  <button
                    className="px-2 py-1 bg-gray-100 text-xs rounded"
                    onClick={() => onEdit && onEdit(r)}
                  >
                    Edit
                  </button>
                  <button
                    className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded"
                    onClick={() => onDelete && onDelete(idString)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
          {records.length === 0 && (
            <tr>
              <td className="p-6 text-center text-gray-500" colSpan="8">
                No records yet
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
