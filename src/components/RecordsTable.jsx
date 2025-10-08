// src/components/RecordsTable.jsx
import React from "react";

function formatTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
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
              r.route && r.route[r.currentIndex]
                ? r.route[r.currentIndex].city
                : "—";
            const progress =
              r.route && r.route.length > 1
                ? Math.round((r.currentIndex / (r.route.length - 1)) * 100)
                : 0;
            return (
              <tr key={r._id || r.trackingId} className="border-t">
                <td className="px-3 py-2 align-top">
                  <div className="font-mono text-xs">{r.trackingId}</div>
                </td>
                <td className="px-3 py-2 align-top">{r.customerName || "—"}</td>
                <td className="px-3 py-2 align-top">{r.product}</td>
                <td className="px-3 py-2 align-top">{currentCity}</td>
                <td className="px-3 py-2 align-top">
                  <div>{r.status}</div>
                  <div className="text-xs text-gray-400">{progress}%</div>
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
                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded"
                    onClick={() => onNext(r._id?.toString() || r.trackingId)}
                  >
                    Next Stop
                  </button>
                  <button
                    className="px-2 py-1 bg-gray-100 text-xs rounded"
                    onClick={() => onEdit(r)}
                  >
                    Edit
                  </button>
                  <button
                    className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded"
                    onClick={() =>
                      onDelete && onDelete(r._id?.toString() || r.trackingId)
                    }
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
