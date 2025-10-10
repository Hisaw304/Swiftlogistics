import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { RefreshCw, MapPin, Package } from "lucide-react";
import ProgressBar from "../components/ProgressBar";
import RouteTimeline from "../components/RouteTimeline";
import RouteMap from "../components/RouteMap";

const statusInfo = {
  pending: {
    text: "⏳ Your order is being processed and will ship soon.",
    color: "text-gray-600",
  },
  "on hold": {
    text: "⚠️ Your order is currently on hold. Please contact support for details.",
    color: "text-yellow-700",
    link: "/contact",
  },
  shipped: {
    text: "🚚 Your order has been shipped and is on its way.",
    color: "text-blue-700",
  },
  "out for delivery": {
    text: "📦 Your package is out for delivery. Expect it soon!",
    color: "text-indigo-700",
  },
  delivered: {
    text: "✅ Your order has been delivered successfully. Thank you!",
    color: "text-green-700",
  },
  exception: {
    text: "❌ There was an issue with your delivery. Please contact support.",
    color: "text-red-700",
    link: "/contact",
  },
};

// Reusable card header to match your site pattern (small label + title)
function CardHeader({ label }) {
  return (
    <div className="card-header">
      <div className="card-label-row">
        <span className="shape shape-left" aria-hidden>
          <svg
            width="59"
            height="5"
            viewBox="0 0 59 5"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              width="50"
              height="5"
              rx="2.5"
              fill="var(--color-secondary)"
            ></rect>
            <circle
              cx="56.5"
              cy="2.5"
              r="2.5"
              fill="var(--color-secondary)"
            ></circle>
          </svg>
        </span>

        <span className="card-label uppercase text-sm font-semibold text-[var(--color-primary)]">
          {label}
        </span>

        <span className="shape shape-right" aria-hidden>
          <svg
            width="59"
            height="5"
            viewBox="0 0 59 5"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              width="50"
              height="5"
              rx="2.5"
              transform="matrix(-1 0 0 1 59 0)"
              fill="var(--color-secondary)"
            ></rect>
            <circle
              cx="2.5"
              cy="2.5"
              r="2.5"
              transform="matrix(-1 0 0 1 5 0)"
              fill="var(--color-secondary)"
            ></circle>
          </svg>
        </span>
      </div>
    </div>
  );
}

// tiny inline icon fallback to avoid adding another dependency in case lucide-react is missing
function AlertIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-red-600"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  );
}

export default function TrackingPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [imgError, setImgError] = useState(false);
  const [prevLocation, setPrevLocation] = useState(null);
  const [showAll, setShowAll] = useState(false);

  async function fetchWithTimeout(url, options = {}, timeout = 12000) {
    const controller = new AbortController();
    const idt = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(idt);
      return res;
    } catch (err) {
      clearTimeout(idt);
      throw err;
    }
  }

  const fetchTracking = async () => {
    if (!id) throw new Error("Missing tracking id");
    const res = await fetchWithTimeout(
      `/api/public/track?trackingId=${encodeURIComponent(id)}`,
      { headers: { Accept: "application/json" } },
      12000
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      let parsed = null;
      try {
        parsed = txt ? JSON.parse(txt) : null;
      } catch (e) {
        parsed = null;
      }
      throw new Error(parsed?.error || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const [loadingManual, setLoadingManual] = useState(false);
  const [manualError, setManualError] = useState(null);

  async function loadTracking() {
    if (!id) {
      setData(null);
      return;
    }
    setLoadingManual(true);
    setManualError(null);
    try {
      const json = await fetchTracking();

      try {
        const oldLoc = data?.currentLocation || null;
        const newLoc = json?.currentLocation || null;

        const coordsOf = (c) => {
          if (!c) return null;
          if (Array.isArray(c) && c.length >= 2) {
            const a = Number(c[0]),
              b = Number(c[1]);
            if (a >= -90 && a <= 90 && b >= -180 && b <= 180) return [a, b];
            return [Number(c[1]), Number(c[0])];
          }
          if (c && c.type === "Point" && Array.isArray(c.coordinates)) {
            const [lng, lat] = c.coordinates;
            return [Number(lat), Number(lng)];
          }
          if (c && typeof c.lat === "number" && typeof c.lng === "number") {
            return [Number(c.lat), Number(c.lng)];
          }
          return null;
        };

        const oc = coordsOf(oldLoc),
          nc = coordsOf(newLoc);
        if (oc && nc && (oc[0] !== nc[0] || oc[1] !== nc[1])) {
          setPrevLocation(oldLoc);
        } else if (!oc && nc) {
          setPrevLocation(null);
        }
      } catch (e) {
        // ignore compare errors
      }

      setData(json || null);
    } catch (err) {
      setManualError(err);
    } finally {
      setLoadingManual(false);
    }
  }

  useEffect(() => {
    loadTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // derive commonly used vars (defensive)
  const route = Array.isArray(data?.route) ? data.route : [];
  const currentIndex =
    typeof data?.currentIndex === "number" ? data.currentIndex : 0;
  const { windowed, mappedIndex, isWindowed } = computeWindowedRoute(
    route,
    currentIndex,
    2
  );
  const routeToRender = showAll ? route : windowed;
  const indexForRender = showAll ? currentIndex : mappedIndex;

  function computeWindowedRoute(route = [], currentIndex = 0, windowSize = 2) {
    if (!Array.isArray(route) || route.length === 0)
      return { windowed: [], mappedIndex: 0 };

    const total = route.length;
    const origin = route[0];
    const dest = route[total - 1];
    const idx = Math.max(0, Math.min(total - 1, Number(currentIndex) || 0));
    if (total <= 7)
      return { windowed: route, mappedIndex: idx, isWindowed: false };

    const start = Math.max(1, idx - windowSize);
    const end = Math.min(total - 2, idx + windowSize);
    const middle = route.slice(start, end + 1);
    const windowed = [origin, ...middle, dest];
    const mappedIndex =
      idx <= 0 ? 0 : idx >= total - 1 ? windowed.length - 1 : 1 + (idx - start);

    return { windowed, mappedIndex, isWindowed: true, start, end, total, idx };
  }

  const progress = useMemo(() => {
    if (typeof data?.progressPct === "number") return data.progressPct;
    if (route.length > 1)
      return Math.round((currentIndex / (route.length - 1)) * 100);
    return 0;
  }, [data, route.length, currentIndex]);

  const imgSrc =
    !imgError && data?.imageUrl ? data.imageUrl : "/placeholder.png";
  const status = data?.status || "Pending";

  const formatTime = (iso) => {
    if (!iso) return "—";
    try {
      return new Intl.DateTimeFormat(navigator.language, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(iso));
    } catch (e) {
      return new Date(iso).toLocaleString();
    }
  };

  const formatLocation = (loc) => {
    if (!loc) return "—";
    if (typeof loc === "string") return loc;
    if (Array.isArray(loc)) {
      if (
        loc.length >= 2 &&
        typeof loc[0] === "number" &&
        typeof loc[1] === "number"
      )
        return `${loc[1].toFixed(4)}, ${loc[0].toFixed(4)}`;
      return JSON.stringify(loc);
    }
    if (loc.type === "Point" && Array.isArray(loc.coordinates)) {
      const [lng, lat] = loc.coordinates;
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    if (typeof loc.lat === "number" && typeof loc.lng === "number")
      return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
    try {
      return JSON.stringify(loc);
    } catch {
      return "—";
    }
  };

  const normalizePoint = (loc) => {
    if (!loc) return null;
    if (Array.isArray(loc) && loc.length >= 2)
      return { lat: Number(loc[1]), lng: Number(loc[0]) };
    if (loc.type === "Point" && Array.isArray(loc.coordinates))
      return {
        lat: Number(loc.coordinates[1]),
        lng: Number(loc.coordinates[0]),
      };
    if (typeof loc.lat === "number" && typeof loc.lng === "number")
      return { lat: Number(loc.lat), lng: Number(loc.lng) };
    return null;
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(id || "");
    } catch {}
  };

  const openExternal = () => {
    const origin = window.location.origin;
    const url = `${origin}/track/${encodeURIComponent(id)}`;
    window.open(url, "_blank", "noopener");
  };

  const loading = loadingManual && !data;
  const error = manualError ? manualError.message || String(manualError) : null;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-24 px-4">
        <div className="w-full card-modern rounded-lg p-8">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-6 bg-slate-100 rounded w-1/3 animate-pulse mb-3"></div>
              <div className="h-48 bg-slate-100 rounded animate-pulse" />
            </div>
            <div className="w-48 hidden sm:block">
              <div className="h-48 bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-3xl mx-auto py-24 px-4">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="alert-card"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center justify-center gap-3">
            <AlertIcon />
            <div className="font-semibold">{error}</div>
          </div>
          <div className="mt-3">
            <button
              className="btn-ghost inline-flex items-center gap-2 px-3 py-1.5"
              onClick={() => loadTracking()}
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto py-24 px-4">
        <div className="card-modern rounded-lg p-8 text-center">
          <p className="text-gray-700">No tracking data found for this ID.</p>
          <div className="mt-4">
            <button className="btn-primary" onClick={() => navigate("/")}>
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto mt-8 px-4 pb-12"
    >
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Tracking ID: {id}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-ghost"
            onClick={() => loadTracking()}
            title="Refresh"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            className="btn-ghost"
            onClick={copyId}
            title="Copy tracking id"
          >
            Copy ID
          </button>
          <button
            className="btn-primary"
            onClick={openExternal}
            title="Open details"
          >
            Open in new tab
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: modern vertical card stack */}
        <div className="md:col-span-1 space-y-4">
          {/* Image */}
          <div className="card-modern p-4">
            <div className="media-wrap">
              <img
                src={imgSrc}
                alt={
                  data?.productDescription || data?.product || "Product image"
                }
                onError={() => setImgError(true)}
                className="media-image"
              />
            </div>
          </div>

          {/* Shipment Summary Card */}
          <div className="card-modern p-4">
            <CardHeader label="Shipment Summary" />
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <div className="icon-circle">
                    <Package size={16} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">
                      {data?.productDescription || data?.product || "Product"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {data?.serviceType ? `${data.serviceType}` : "Service: —"}
                      {data?.shipmentDetails
                        ? ` • ${data.shipmentDetails}`
                        : ""}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  Qty: {data?.quantity ?? 1}
                </div>
              </div>

              <div className="mt-3 text-sm text-gray-600">
                <div>
                  <span className="font-medium text-gray-800">Weight:</span>{" "}
                  {data?.weightKg ? `${data.weightKg} kg` : "—"}
                </div>
                {data?.description && (
                  <div className="mt-1 text-xs text-gray-500">
                    {data.description}
                  </div>
                )}
              </div>

              <div className="mt-3">
                <div className="text-xs text-gray-500">Current status</div>
                <div
                  className={`status-pill mt-1 ${
                    status === "Delivered"
                      ? "status-delivered"
                      : status === "Shipped"
                      ? "status-shipped"
                      : "status-pending"
                  }`}
                >
                  {status}
                </div>
              </div>
            </div>
          </div>

          {/* Progress Card */}
          <div className="card-modern p-4">
            <CardHeader label="Delivery Progress" />
            <div className="card-body">
              <ProgressBar progress={progress} status={status} />
              <div className="text-xs text-gray-400 mt-2">
                {progress}% • Checkpoint{" "}
                {Math.min(currentIndex + 1, route.length)} of{" "}
                {route.length || "?"}
              </div>
            </div>
          </div>

          {/* Recipient Information Card */}
          <div className="card-modern p-4">
            <CardHeader label="Recipient Information" />
            <div className="card-body text-sm text-gray-600 space-y-2">
              <div>
                <span className="font-medium text-gray-800">Name:</span>{" "}
                {data?.destination?.receiverName || data?.customerName || "—"}
              </div>
              <div>
                <span className="font-medium text-gray-800">Email:</span>{" "}
                {data?.destination?.receiverEmail || "—"}
              </div>
              <div>
                <span className="font-medium text-gray-800">Address:</span>{" "}
                {data?.destination?.address?.full
                  ? `${data.destination.address.full}, ${
                      data.destination.address.city || ""
                    }${
                      data.destination.address.state
                        ? `, ${data.destination.address.state}`
                        : ""
                    } ${data.destination.address.zip || ""}`
                  : data?.address?.full
                  ? `${data.address.full}, ${data.address.city || ""}${
                      data.address.state ? `, ${data.address.state}` : ""
                    } ${data.address.zip || ""}`
                  : "—"}
              </div>
              <div>
                <span className="font-medium text-gray-800">Destination:</span>{" "}
                {data?.route?.slice(-1)[0]?.city ||
                  data?.destination?.address?.city ||
                  data?.destination?.city ||
                  "—"}
              </div>
            </div>
          </div>

          {/* Origin / Sender Card */}
          <div className="card-modern p-4">
            <CardHeader label="Origin / Sender" />
            <div className="card-body text-sm text-gray-600 space-y-2">
              <div>
                <span className="font-medium text-gray-800">Sender:</span>{" "}
                {data?.origin?.name || data?.originWarehouse || "—"}
              </div>
              <div>
                <span className="font-medium text-gray-800">
                  Sender Address:
                </span>{" "}
                {data?.origin?.address?.full
                  ? `${data.origin.address.full}, ${
                      data.origin.address.city || ""
                    }${
                      data.origin.address.state
                        ? `, ${data.origin.address.state}`
                        : ""
                    } ${data.origin.address.zip || ""}`
                  : "—"}
              </div>
              <div>
                <span className="font-medium text-gray-800">
                  Origin Location:
                </span>{" "}
                {data?.origin?.location
                  ? formatLocation(data.origin.location)
                  : data?.originWarehouse
                  ? data.originWarehouse
                  : "—"}
              </div>
            </div>
          </div>

          {/* Dates Card */}
          <div className="card-modern p-4">
            <CardHeader label="Dates" />
            <div className="card-body text-sm text-gray-600 space-y-2">
              <div>
                <span className="font-medium text-gray-800">Shipped:</span>{" "}
                {data?.shipmentDate || data?.shippedDate
                  ? formatTime(data.shipmentDate || data.shippedDate)
                  : "—"}
              </div>
              <div>
                <span className="font-medium text-gray-800">Expected:</span>{" "}
                {data?.destination?.expectedDeliveryDate ||
                data?.expectedDeliveryDate
                  ? formatTime(
                      data.destination?.expectedDeliveryDate ||
                        data.expectedDeliveryDate
                    )
                  : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Middle + Right: route timeline and map */}
        <div className="md:col-span-2 space-y-6">
          <div className="card-modern p-4">
            <CardHeader label="Route & Checkpoints" />
            <div className="card-body">
              {route.length > 0 ? (
                <RouteTimeline
                  route={routeToRender}
                  currentIndex={indexForRender}
                />
              ) : (
                <div className="text-sm text-gray-500">
                  Route not available yet.
                </div>
              )}
            </div>
            {isWindowed && (
              <div className="mt-3 text-right">
                <button
                  className="btn-ghost"
                  onClick={() => setShowAll((s) => !s)}
                >
                  {showAll ? "Show window" : "Show full route"}
                </button>
              </div>
            )}
          </div>

          <div className="card-modern p-4">
            <CardHeader label="Delivery Route Map" />
            <div className="card-body">
              <div className="rounded overflow-hidden h-[420px] bg-gray-50">
                {route.length > 0 ? (
                  <RouteMap
                    route={routeToRender}
                    currentIndex={indexForRender}
                    currentLocation={data?.currentLocation}
                    prevLocation={prevLocation}
                    height={420}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500">
                    Map will appear when route data is available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Note */}
      {(() => {
        const info = statusInfo[status.toLowerCase()];
        if (!info) return null;
        return (
          <div className={`text-center mt-6 font-medium text-lg ${info.color}`}>
            {info.text}
            {info.link && (
              <>
                {" "}
                <a
                  href={info.link}
                  className="underline text-blue-700 hover:text-blue-900"
                >
                  Contact support
                </a>
                .
              </>
            )}
          </div>
        );
      })()}
    </motion.div>
  );
}
