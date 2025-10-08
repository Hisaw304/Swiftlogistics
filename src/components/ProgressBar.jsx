// src/components/ProgressBar.jsx
import React, { useMemo } from "react";
import { motion } from "framer-motion";

/**
 * Props:
 *  - progress?: number    // 0-100 (highest precedence)
 *  - status?: string      // if progress not provided, map status -> percent
 *  - className?: string
 *  - showLabel?: boolean  // optionally show percentage or status text
 */
export default function ProgressBar({
  progress,
  status,
  className = "",
  showLabel = false,
}) {
  // map common status strings to a percentage
  const statusToPct = (s) => {
    if (!s) return 0;
    const x = String(s).trim().toLowerCase();
    switch (x) {
      case "pending":
        return 0;
      case "on hold":
        return 10;
      case "shipped":
        return 50;
      case "out for delivery":
        return 85;
      case "delivered":
        return 100;
      case "exception":
        return 100;
      default:
        // if status contains a percent like "50%" try parse
        const m = String(s).match(/(\d{1,3})\s*%/);
        if (m) return Math.max(0, Math.min(100, Number(m[1])));
        return 0;
    }
  };

  // determine numeric percentage (progress prop wins)
  const pct = useMemo(() => {
    if (typeof progress === "number" && !Number.isNaN(progress)) {
      return Math.max(0, Math.min(100, Math.round(progress)));
    }
    return Math.max(0, Math.min(100, Math.round(statusToPct(status))));
  }, [progress, status]);

  // color logic (exception -> red)
  const colorClass =
    pct === 100 && String(status).toLowerCase() === "exception"
      ? "bg-red-500"
      : pct === 100
      ? "bg-green-500"
      : pct >= 60
      ? "bg-blue-500"
      : "bg-yellow-500";

  // label to show (status name preferred)
  const label = showLabel ? (status ? status : `${pct}%`) : null;

  return (
    <div
      className={`w-full bg-gray-200 rounded-full h-3 overflow-hidden ${className}`}
    >
      <motion.div
        // use key so framer-motion re-initializes when pct jumps dramatically
        key={pct}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`h-full ${colorClass}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={status ? `Progress: ${status}` : `Progress ${pct}%`}
      />
      {label && <div className="text-xs mt-1 text-gray-600">{label}</div>}
    </div>
  );
}
