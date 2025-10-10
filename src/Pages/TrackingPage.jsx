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

// Modernized TrackingPage — defaults to graceful fallbacks, timeouts, and nicer UI
export default function TrackingPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [imgError, setImgError] = useState(false);
  const [prevLocation, setPrevLocation] = useState(null); // previous location for animation
  const [showAll, setShowAll] = useState(false);

  // small fetch helper with timeout (kept from your original)
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

  // fetch function used by polite polling hook
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
  // === Manual fetch mode (no automatic polling) ===
  const [loadingManual, setLoadingManual] = useState(false);
  const [manualError, setManualError] = useState(null);

  // Call this to load current record (manual or initial)
  async function loadTracking() {
    if (!id) {
      setData(null);
      return;
    }
    setLoadingManual(true);
    setManualError(null);
    try {
      const json = await fetchTracking();

      // update prevLocation for animation if location changed
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

  // Optionally load once when the page mounts / id changes (manual-first UX)
  useEffect(() => {
    loadTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // derive commonly used vars (defensive)
  const route = Array.isArray(data?.route) ? data.route : [];
  const currentIndex =
    typeof data?.currentIndex === "number" ? data.currentIndex : 0;
  // compute a trimmed route view and mapped index for the map/timeline
  const { windowed, mappedIndex, isWindowed } = computeWindowedRoute(
    route,
    currentIndex,
    2
  ); // windowSize=2 (tweak)
  const routeToRender = showAll ? route : windowed;
  const indexForRender = showAll ? currentIndex : mappedIndex;

  // ---------- start windowing helper (paste here, inside TrackingPage) ----------
  function computeWindowedRoute(route = [], currentIndex = 0, windowSize = 2) {
    // keep origin and destination always
    if (!Array.isArray(route) || route.length === 0)
      return { windowed: [], mappedIndex: 0 };

    const total = route.length;
    const origin = route[0];
    const dest = route[total - 1];

    // clamp currentIndex
    const idx = Math.max(0, Math.min(total - 1, Number(currentIndex) || 0));

    // if route is small, return as-is
    if (total <= 7)
      return { windowed: route, mappedIndex: idx, isWindowed: false };

    // pick window around currentIndex (N before, N after)
    const start = Math.max(1, idx - windowSize);
    const end = Math.min(total - 2, idx + windowSize);

    // compose: origin + middle slice + dest
    const middle = route.slice(start, end + 1);
    const windowed = [origin, ...middle, dest];

    // map original currentIndex to new index in windowed array
    // origin maps to 0; original index 'start' maps to 1, etc.
    const mappedIndex =
      idx <= 0 ? 0 : idx >= total - 1 ? windowed.length - 1 : 1 + (idx - start);

    return { windowed, mappedIndex, isWindowed: true, start, end, total, idx };
  }
  // ---------- end windowing helper ----------

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
    if (Array.isArray(loc) && loc.length >= 2) {
      // assume [lng, lat]
      return { lat: Number(loc[1]), lng: Number(loc[0]) };
    }
    if (loc.type === "Point" && Array.isArray(loc.coordinates)) {
      return {
        lat: Number(loc.coordinates[1]),
        lng: Number(loc.coordinates[0]),
      };
    }
    if (typeof loc.lat === "number" && typeof loc.lng === "number") {
      return { lat: Number(loc.lat), lng: Number(loc.lng) };
    }
    return null;
  };

  // small UI actions
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

  // render states (map loading uses polite polling state)
  // with:
  const loading = loadingManual && !data;
  const error = manualError ? manualError.message || String(manualError) : null;

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

  if (error && !data) {
    // show error only if we have no cached data; otherwise show UI and a small banner.
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
              onClick={() => refresh()}
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
      className="tracking-container max-w-6xl mx-auto mt-8 px-4 pb-12"
    >
      {/* decorative small TRACKING label */}
      <div className="flex items-center gap-3">
        <span className="shape shape-left" aria-hidden>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="59"
            height="5"
            viewBox="0 0 59 5"
            fill="none"
          >
            <rect
              width="50"
              height="5"
              rx="2.5"
              fill="var(--color-secondary)"
            />
            <circle cx="56.5" cy="2.5" r="2.5" fill="var(--color-secondary)" />
          </svg>
        </span>

        <span className="uppercase text-sm font-semibold text-[var(--color-primary)]">
          TRACKING
        </span>

        <span className="shape shape-right" aria-hidden>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="59"
            height="5"
            viewBox="0 0 59 5"
            fill="none"
          >
            <rect
              width="50"
              height="5"
              rx="2.5"
              transform="matrix(-1 0 0 1 59 0)"
              fill="var(--color-secondary)"
            />
            <circle
              cx="2.5"
              cy="2.5"
              r="2.5"
              transform="matrix(-1 0 0 1 5 0)"
              fill="var(--color-secondary)"
            />
          </svg>
        </span>
      </div>

      {/* Main heading */}
      <div className="flex items-start justify-between gap-4 mb-4 mt-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            Tracking Information
          </h1>
        </div>
      </div>

      {/* CTA-style tracking summary card (prominent) */}
      <div className="tracking-cta trk-card rounded-lg p-4 shadow-md">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="inline-block card-heading-inline">Tracking ID</div>
            <div className="mt-2 text-lg md:text-2xl font-bold break-words">
              {id}
            </div>
            <div className="mt-1 text-sm text-gray-600">
              {data?.productDescription || data?.product || ""}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
            <div>
              <div className="card-heading">Shipped</div>
              <div className="mt-1 text-sm md:text-base font-medium">
                {data?.shipmentDate || data?.shippedDate
                  ? formatTime(data.shipmentDate || data.shippedDate)
                  : "—"}
              </div>
            </div>

            <div>
              <div className="card-heading">Expected</div>
              <div className="mt-1 text-sm md:text-base font-medium">
                {data?.destination?.expectedDeliveryDate ||
                data?.expectedDeliveryDate
                  ? formatTime(
                      data.destination?.expectedDeliveryDate ||
                        data.expectedDeliveryDate
                    )
                  : "—"}
              </div>
            </div>

            <div>
              <div className="card-heading">Status</div>
              <div className="mt-1">
                <div
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
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
          </div>
        </div>

        {/* status note inside CTA card */}
        {statusInfo && statusInfo[status?.toLowerCase()] && (
          <div className="mt-4 trk-status-note p-3 rounded">
            <div className="text-sm font-medium">
              {statusInfo[status.toLowerCase()].text}
            </div>
            {statusInfo[status.toLowerCase()].link && (
              <div className="mt-2">
                <a
                  href={statusInfo[status.toLowerCase()].link}
                  className="underline text-blue-700 hover:text-blue-900"
                >
                  Contact support
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* === original grid (kept intact, only minor heading + border tweaks) === */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {/* Left column: image + grouped cards */}
        <div className="md:col-span-1 bg-white rounded-lg p-4 shadow-sm space-y-4 trk-card">
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
          <div className="bg-gray-50 rounded p-3 trk-card">
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
          <div className="bg-white rounded p-3 trk-card">
            <div className="text-xs text-gray-500">Delivery Progress</div>
            <div className="mt-2">
              <ProgressBar progress={progress} status={status} />
              <div className="text-xs text-gray-400 mt-1">
                {progress}% • Checkpoint{" "}
                {Math.min(currentIndex + 1, route.length)} of{" "}
                {route.length || "?"}
              </div>
            </div>
          </div>

          {/* Recipient Information Card */}
          <div className="bg-white rounded p-3 trk-card">
            <h3 className="text-base font-semibold text-gray-700 mb-2 card-heading">
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
                {data?.route?.slice(-1)[0]?.city ||
                  data?.destination?.address?.city ||
                  data?.destination?.city ||
                  "—"}
              </div>
            </div>
          </div>

          {/* Sender Information (renamed + styled) */}
          <div className="bg-white rounded p-3 trk-card">
            <h3 className="text-base font-semibold text-gray-700 mb-2 card-heading">
              Sender Information
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

          {/* Dates Card */}
          <div className="bg-white rounded p-3 trk-card">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 card-heading">
              Dates
            </h3>

            <div className="text-sm text-gray-600 space-y-1">
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
          <div className="bg-white rounded-lg p-4 shadow-sm trk-card">
            <h2 className="font-semibold mb-3">Route & Checkpoints</h2>
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

          <div className="bg-white rounded-lg p-4 shadow-sm trk-card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Delivery Route Map</h2>
            </div>
            <div className="rounded overflow-hidden h-[420px] bg-gray-50">
              {route.length > 0 ? (
                <>
                  <RouteMap
                    route={routeToRender}
                    currentIndex={indexForRender}
                    currentLocation={data?.currentLocation}
                    prevLocation={prevLocation}
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
        </div>
      </div>

      {/* keep bottom status note as it was (left intact) */}
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
