// src/pages/TrackingPage.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import ProgressBar from "../components/ProgressBar";
import RouteTimeline from "../components/RouteTimeline";
import RouteMap from "../components/RouteMap";

const Loading = () => (
  <div className="py-12 text-center text-gray-600">Loading tracking data…</div>
);

const ErrorBox = ({ message }) => (
  <div className="py-12 text-center text-red-600 font-semibold">{message}</div>
);

const formatTime = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

const TrackingPage = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("No tracking ID provided.");
      return;
    }

    const ac = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/public/track?trackingId=${encodeURIComponent(id)}`, {
      signal: ac.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to load tracking data.");
        setLoading(false);
      });

    return () => ac.abort();
  }, [id]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  if (!data) {
    return <ErrorBox message="❌ No tracking data found for this ID." />;
  }

  const route = Array.isArray(data.route) ? data.route : [];
  const currentIndex =
    typeof data.currentIndex === "number" ? data.currentIndex : 0;
  const progress =
    typeof data.progressPct === "number"
      ? data.progressPct
      : route.length > 1
      ? Math.round((currentIndex / (route.length - 1)) * 100)
      : 0;

  const imgSrc = data.imageUrl || "/placeholder.png";
  const status = data.status || "Pending";

  return (
    <div className="max-w-5xl mx-auto mt-5 py-16 px-4">
      <h2 className="text-3xl font-bold text-center mb-6">Tracking ID: {id}</h2>

      <div className="bg-white shadow-lg rounded-xl p-6 space-y-8">
        {/* Product Info */}
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
          <img
            src={imgSrc}
            alt="Product"
            className="w-48 h-48 object-contain p-2 rounded-lg shadow"
          />
          <div className="text-left">
            <p className="text-xl font-semibold text-gray-800">
              {data.product || "Product"}
            </p>
            <p className="text-gray-600">Quantity: {data.quantity ?? 1}</p>
            {data.eta && <p className="text-gray-600">ETA: {data.eta}</p>}
            <p
              className={`mt-2 font-medium ${
                status === "Delivered"
                  ? "text-green-600"
                  : status === "Shipped"
                  ? "text-blue-600"
                  : "text-yellow-600"
              }`}
            >
              Status: {status}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Last updated: {formatTime(data.lastUpdated)}
            </p>
          </div>
        </div>

        {/* Recipient Info */}
        <div className="border-t pt-4 text-left">
          <p className="font-semibold text-gray-700">
            Recipient (public view):
          </p>
          <p>
            {data.customerName ? data.customerName : "Recipient info hidden"}
          </p>
          <p className="text-gray-600">
            {data.address?.full || data.address?.city || "—"}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <p className="mb-2 font-medium">Delivery Progress:</p>
          <ProgressBar progress={progress} />
          <p className="text-sm mt-1 text-gray-500">
            {progress}% complete — Checkpoint{" "}
            {Math.min(currentIndex + 1, route.length)} of {route.length || "?"}
          </p>
        </div>

        {/* Route Timeline */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Route & Checkpoints</h3>
          <RouteTimeline route={route} currentIndex={currentIndex} />
        </div>

        {/* Route Map */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Delivery Route Map</h3>
          <div className="rounded overflow-hidden">
            <RouteMap
              route={route}
              currentIndex={currentIndex}
              currentLocation={data.currentLocation}
              height={360}
            />
          </div>
        </div>

        {/* Location History */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">Location History</h3>
          {Array.isArray(data.locationHistory) &&
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
                        {h.city || (h.location ? "Lat/Lng update" : "Update")}
                      </div>
                      <div className="text-gray-500 text-xs">
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
            <p className="text-gray-500">No history recorded yet.</p>
          )}
        </div>

        {/* Status Note */}
        <div className="text-center mt-6 font-medium text-lg">
          {status === "Delivered" && (
            <span className="text-green-700">
              ✅ Your order has been delivered successfully.
            </span>
          )}
          {status === "Shipped" && (
            <span className="text-blue-700">🚚 Your order is on the way.</span>
          )}
          {status === "On Hold" && (
            <span className="text-yellow-700">
              ⚠️ Your order is on hold.{" "}
              <a
                href="/contact"
                className="underline text-blue-700 hover:text-blue-900"
              >
                Contact support
              </a>
              .
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrackingPage;
