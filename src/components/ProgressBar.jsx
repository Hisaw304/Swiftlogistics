// src/components/ProgressBar.jsx
import React from "react";
import { motion } from "framer-motion";

export default function ProgressBar({ progress = 0, className = "" }) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const colorClass =
    pct === 100 ? "bg-green-500" : pct >= 60 ? "bg-blue-500" : "bg-yellow-500";
  return (
    <div
      className={`w-full bg-gray-200 rounded-full h-3 overflow-hidden ${className}`}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8 }}
        className={`h-full ${colorClass}`}
      />
    </div>
  );
}
