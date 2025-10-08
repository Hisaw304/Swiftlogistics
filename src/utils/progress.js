// utils/progress.js (or at top of component file)
export function computeProgressPct(record) {
  const routeLen = Array.isArray(record?.route) ? record.route.length : 0;
  const idx =
    typeof record?.currentIndex === "number" ? record.currentIndex : 0;
  if (routeLen > 1) return Math.round((idx / (routeLen - 1)) * 100);
  // fallback to status mapping (if you want)
  const status = (record?.status || "").toLowerCase();
  if (status === "delivered") return 100;
  if (status === "out for delivery") return 85;
  if (status === "shipped") return 50;
  if (status === "on hold") return 10;
  return 0;
}
