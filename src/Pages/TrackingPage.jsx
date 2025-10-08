import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Copy,
  ExternalLink,
  RefreshCw,
  MapPin,
  Package,
  Clock,
  User,
  X,
} from "lucide-react";
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

// Modernized TrackingPage — defaults to graceful fallbacks, timeouts, and nicer UI
export default function TrackingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState(null);
  const [imgError, setImgError] = useState(false);

  // small fetch helper with timeout
  async function fetchWithTimeout(url, options = {}, timeout = 12000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("No tracking ID provided.");
      setData(null);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetchWithTimeout(
          `/api/public/track?trackingId=${encodeURIComponent(id)}`,
          { headers: { Accept: "application/json" } },
          12000
        );
        if (!res.ok) {
          // try to parse JSON error message, otherwise throw status
          const txt = await res.text().catch(() => "");
          let parsed = null;
          try {
            parsed = txt ? JSON.parse(txt) : null;
          } catch (e) {
            parsed = null;
          }
          throw new Error(parsed?.error || `HTTP ${res.status}`);
        }
        const json = await res.json();
        if (!alive) return;
        setData(json || null);
      } catch (err) {
        if (err.name === "AbortError") return; // ignore aborts
        setError(err.message || "Failed to load tracking data.");
        setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  // defensive data access
  const route = Array.isArray(data?.route) ? data.route : [];
  const currentIndex =
    typeof data?.currentIndex === "number" ? data.currentIndex : 0;

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
  // place somewhere near formatTime helper
  const formatLocation = (loc) => {
    if (!loc) return "—";
    // already a string
    if (typeof loc === "string") return loc;
    // array [lng, lat]
    if (Array.isArray(loc)) {
      if (
        loc.length >= 2 &&
        typeof loc[0] === "number" &&
        typeof loc[1] === "number"
      )
        return `${loc[1].toFixed(4)}, ${loc[0].toFixed(4)}`;
      return JSON.stringify(loc);
    }
    // GeoJSON Point: { type: "Point", coordinates: [lng, lat] }
    if (loc.type === "Point" && Array.isArray(loc.coordinates)) {
      const [lng, lat] = loc.coordinates;
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    // lat/lng fields
    if (typeof loc.lat === "number" && typeof loc.lng === "number")
      return `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`;
    // fallback
    try {
      return JSON.stringify(loc);
    } catch {
      return "—";
    }
  };

  // small UI actions
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(id || "");
      // small visual feedback could be added here (toast)
    } catch {}
  };

  const openExternal = () => {
    const origin = window.location.origin;
    const url = `${origin}/track/${encodeURIComponent(id)}`;
    window.open(url, "_blank", "noopener");
  };

  // render states
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-24 px-4">
        <div className="w-full bg-white/60 dark:bg-gray-900/60 rounded-lg p-8 shadow-md backdrop-blur">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse mb-3"></div>
              <div className="h-48 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="w-48 hidden sm:block">
              <div className="h-48 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto py-24 px-4">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-100 text-red-800 rounded-lg p-6 text-center"
          role="alert"
          aria-live="assertive"
        >
          <div className="flex items-center justify-center gap-3">
            <AlertIcon />
            <div className="font-semibold">{error}</div>
          </div>
          <div className="mt-3">
            <button
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded border text-sm"
              onClick={() => window.location.reload()}
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
        <div className="bg-white/60 rounded-lg p-8 text-center">
          <p className="text-gray-700">No tracking data found for this ID.</p>
          <div className="mt-4">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded"
              onClick={() => navigate("/")}
            >
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
          <h1 className="text-2xl md:text-3xl font-bold">Tracking ID: {id}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Last updated: {formatTime(data?.lastUpdated)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            title="Copy tracking ID"
            onClick={copyId}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded text-sm"
          >
            <Copy size={14} /> Copy
          </button>
          <button
            title="Open in new tab"
            onClick={openExternal}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded text-sm"
          >
            <ExternalLink size={14} /> Open
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left column: image + grouped cards */}
        <div className="md:col-span-1 bg-white rounded-lg p-4 shadow-sm space-y-4">
          {/* Image */}
          <div className="w-full h-64 bg-gray-50 rounded overflow-hidden flex items-center justify-center">
            <img
              src={imgSrc}
              alt={data?.productDescription || data?.product || "Product image"}
              onError={() => setImgError(true)}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          {/* Shipment Summary Card */}
          <div className="bg-gray-50 rounded p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Package size={14} />
                <div>
                  <div className="font-medium text-gray-800">
                    {data?.productDescription || data?.product || "Product"}
                  </div>
                  <div className="text-xs text-gray-500">
                    {data?.serviceType ? `${data.serviceType}` : "Service: —"}
                    {data?.shipmentDetails ? ` • ${data.shipmentDetails}` : ""}
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
                className={`mt-1 inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  status === "Delivered"
                    ? "bg-green-100 text-green-800"
                    : status === "Shipped"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {status}
              </div>
            </div>
          </div>

          {/* Progress Card */}
          <div className="bg-white rounded p-3 border">
            <div className="text-xs text-gray-500">Delivery Progress</div>
            <div className="mt-2">
              <ProgressBar
                progress={progressPct}
                status={status}
                showLabel={true}
              />
              <div className="text-xs text-gray-400 mt-1">
                {progress}% • Checkpoint{" "}
                {Math.min(currentIndex + 1, route.length)} of{" "}
                {route.length || "?"}
              </div>
            </div>
          </div>

          {/* Recipient Information Card */}
          <div className="bg-white rounded p-3 border">
            <h3 className="text-base font-semibold text-gray-700 mb-2">
              Recipient Information
            </h3>
            <div className="text-sm text-gray-600 space-y-1">
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
                {data?.route?.slice(-1)[0]?.city || "—"}
              </div>
            </div>
          </div>

          {/* Origin / Sender Card */}
          <div className="bg-white rounded p-3 border">
            <h3 className="text-base font-semibold text-gray-700 mb-2">
              Origin / Sender
            </h3>
            <div className="text-sm text-gray-600 space-y-1">
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

          {/* Dates & Contact Card */}
          <div className="bg-white rounded p-3 border">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Dates & Contact
            </h3>

            <div className="text-sm text-gray-600 space-y-1">
              <div>
                <span className="font-medium text-gray-800">Shipped:</span>{" "}
                {data?.shipmentDate ? formatTime(data.shipmentDate) : "—"}
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
              <div>
                <span className="font-medium text-gray-800">Last updated:</span>{" "}
                {data?.lastUpdated ? formatTime(data.lastUpdated) : "—"}
              </div>
              <div className="mt-2 text-xs text-gray-500">
                <div>
                  <span className="font-medium">Contact:</span>{" "}
                  {data?.contactEmail ||
                    data?.destination?.receiverEmail ||
                    "—"}
                </div>
                {data?.contactPhone && (
                  <div>
                    <span className="font-medium">Phone:</span>{" "}
                    {data.contactPhone}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Middle + Right: route timeline and map */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h2 className="font-semibold mb-3">Route & Checkpoints</h2>
            {route.length > 0 ? (
              <RouteTimeline route={route} currentIndex={currentIndex} />
            ) : (
              <div className="text-sm text-gray-500">
                Route not available yet.
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Delivery Route Map</h2>
              <div className="text-xs text-gray-400">
                Current location: {formatLocation(data?.currentLocation)}
              </div>
            </div>
            <div className="rounded overflow-hidden h-[420px] bg-gray-50">
              {route.length > 0 ? (
                <>
                  <RouteMap
                    route={route}
                    currentIndex={currentIndex}
                    currentLocation={data?.currentLocation}
                    height={420}
                  />
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  Map will appear when route data is available
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h3 className="font-semibold mb-2">Location History</h3>
            {Array.isArray(data?.locationHistory) &&
            data.locationHistory.length > 0 ? (
              <ul className="space-y-3 text-sm text-gray-700">
                {data.locationHistory
                  .slice()
                  .reverse()
                  .map((h, idx) => (
                    <li
                      key={idx}
                      className="flex items-start justify-between gap-4"
                    >
                      <div>
                        <div className="font-medium">
                          {typeof h.city === "string"
                            ? h.city
                            : h.location
                            ? "Lat/Lng update"
                            : "Update"}
                        </div>

                        <div className="text-xs text-gray-500">
                          {h.note || ""}
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-400">
                        {formatTime(h.timestamp)}
                      </div>
                    </li>
                  ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-500">
                No history recorded yet.
              </div>
            )}
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
