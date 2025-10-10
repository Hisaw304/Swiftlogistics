import React from "react";

export default function RouteTimeline({ route = [], currentIndex = 0 }) {
  if (!route || route.length === 0)
    return <div className="text-sm text-gray-500">No route available.</div>;

  // normalize index safely
  const idx =
    typeof currentIndex === "number" && Number.isFinite(currentIndex)
      ? currentIndex
      : Number.isFinite(Number(currentIndex))
      ? Number(currentIndex)
      : 0;

  return (
    <ol className="relative border-l border-gray-300">
      {route.map((cp, i) => {
        const done = i <= idx;
        const cityLabel = cp?.city || cp?.label || `Checkpoint ${i + 1}`;

        return (
          <li key={`${cityLabel}-${i}`} className="mb-6 ml-6">
            <span
              aria-hidden
              className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ${
                done ? "bg-green-500 text-white" : "bg-gray-300 text-gray-700"
              }`}
              title={
                done
                  ? "Completed"
                  : i === idx
                  ? "Current checkpoint"
                  : "Upcoming checkpoint"
              }
            >
              {done ? "✓" : i + 1}
            </span>

            <div
              className="font-semibold"
              aria-label={`Checkpoint ${i + 1} ${cityLabel}`}
            >
              {cityLabel}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
