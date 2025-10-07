// src/components/RouteTimeline.jsx
import React from "react";

export default function RouteTimeline({ route = [], currentIndex = 0 }) {
  if (!route || route.length === 0)
    return <div className="text-sm text-gray-500">No route available.</div>;
  return (
    <ol className="relative border-l border-gray-300">
      {route.map((cp, i) => {
        const done = i <= currentIndex;
        return (
          <li key={i} className="mb-6 ml-6">
            <span
              className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ${
                done ? "bg-green-500 text-white" : "bg-gray-300 text-gray-700"
              }`}
            >
              {done ? "✓" : i + 1}
            </span>
            <div className="font-semibold">
              {cp.city}
              {cp.zip ? ` — ${cp.zip}` : ""}
            </div>
            <div className="text-xs text-gray-500">
              {cp.eta ? new Date(cp.eta).toLocaleString() : ""}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
