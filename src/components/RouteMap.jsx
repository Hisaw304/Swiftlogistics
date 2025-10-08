import React, { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

/**
 * RouteMap (animated)
 * props:
 *  - route: array of checkpoints with { city, zip?, location: { type: "Point", coordinates: [lng, lat] }, eta? }
 *  - currentIndex: integer (index into route)
 *  - currentLocation: GeoJSON Point { type: 'Point', coordinates: [lng, lat] } (optional)
 *  - prevLocation: previous location (same accepted shapes) used for animation
 *  - height: px or CSS value (optional, default 320)
 */

/* Fit bounds helper */
function FitBounds({ latlngs }) {
  const map = useMap();
  useEffect(() => {
    if (!latlngs || latlngs.length === 0) return;
    try {
      map.fitBounds(latlngs, { padding: [40, 40] });
    } catch (e) {
      // ignore
    }
  }, [map, latlngs]);
  return null;
}

/* Utility: normalize various location shapes into [lat, lng] */
function toLatLng(loc) {
  if (!loc) return null;

  // GeoJSON Point: { type: "Point", coordinates: [lng, lat] }
  if (loc.type === "Point" && Array.isArray(loc.coordinates)) {
    const [lng, lat] = loc.coordinates;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    return null;
  }

  // Array: either [lat, lng] or [lng, lat] — we try to detect order.
  if (Array.isArray(loc) && loc.length >= 2) {
    const a = Number(loc[0]);
    const b = Number(loc[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    // Heuristic: if first value is between -90..90 and second between -180..180, treat as [lat,lng]
    if (a >= -90 && a <= 90 && b >= -180 && b <= 180) return [a, b];
    // otherwise treat as [lng,lat]
    return [b, a];
  }

  // Object with lat/lng fields
  if (
    (typeof loc.lat === "number" || typeof loc.lat === "string") &&
    (typeof loc.lng === "number" || typeof loc.lng === "string")
  ) {
    const lat = Number(loc.lat);
    const lng = Number(loc.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    return null;
  }

  // Object with latitude/longitude keys
  if (
    (typeof loc.latitude === "number" || typeof loc.latitude === "string") &&
    (typeof loc.longitude === "number" || typeof loc.longitude === "string")
  ) {
    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    return null;
  }

  return null;
}

/* AnimatedMarker: places a CircleMarker and animates its center when prev->next changes */
function AnimatedMarker({ prev, next, radius = 9, pathOptions }) {
  const markerRef = useRef(null);
  const rafRef = useRef(null);

  const ANIM_MS = 600;

  useEffect(() => {
    const from = toLatLng(prev);
    const to = toLatLng(next);

    if (!to) {
      // nothing to show
      return;
    }

    // get underlying leaflet element
    const marker = markerRef.current;
    if (!marker || !marker._map) {
      // no map yet, we rely on React to position initial marker by props
      return;
    }

    // If no from (initial load), jump to 'to' immediately
    if (!from) {
      try {
        marker.setLatLng(to);
      } catch (e) {}
      return;
    }

    // If same coords, no animation
    if (Math.abs(from[0] - to[0]) < 1e-7 && Math.abs(from[1] - to[1]) < 1e-7) {
      try {
        marker.setLatLng(to);
      } catch (e) {}
      return;
    }

    let start = null;
    function step(ts) {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / ANIM_MS);
      const lat = from[0] + (to[0] - from[0]) * t;
      const lng = from[1] + (to[1] - from[1]) * t;
      try {
        marker.setLatLng([lat, lng]);
      } catch (e) {}
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    }

    // start animation
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // we want to run this effect when prev or next change
  }, [prev, next]);

  // Render a CircleMarker — initial center uses 'next' location so marker is present
  const center = toLatLng(next) || toLatLng(prev) || [0, 0];
  return (
    <CircleMarker
      center={center}
      radius={radius}
      pathOptions={pathOptions}
      ref={markerRef}
    >
      <Tooltip direction="top" offset={[0, -10]}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>Current location</div>
      </Tooltip>
    </CircleMarker>
  );
}

export default function RouteMap({
  route = [],
  currentIndex = 0,
  currentLocation = null,
  prevLocation = null,
  height = 320,
}) {
  // convert route GeoJSON coords [lng,lat] -> [lat,lng] for Leaflet
  const latlngs = useMemo(() => {
    if (!Array.isArray(route)) return [];
    return route
      .map((r) => {
        const coords = r?.location?.coordinates;
        if (!coords || coords.length < 2) return null;
        return [coords[1], coords[0]];
      })
      .filter(Boolean);
  }, [route]);

  const currentLatLng = useMemo(() => {
    const c = toLatLng(currentLocation);
    return c && c.length >= 2 ? c : null;
  }, [currentLocation]);

  const prevLatLng = useMemo(() => {
    const p = toLatLng(prevLocation);
    return p && p.length >= 2 ? p : null;
  }, [prevLocation]);

  // bounds for fitBounds
  const bounds = useMemo(() => {
    const pts = [...latlngs];
    if (currentLatLng) pts.push(currentLatLng);
    return pts.length ? pts : null;
  }, [latlngs, currentLatLng]);

  // If no route at all, show a helpful message but still render a small map with just current location if available
  if (!route || route.length === 0) {
    if (!currentLatLng) {
      return (
        <div className="text-sm text-gray-500">No route data available.</div>
      );
    }
    // Render tiny map centered on current location
    const center = currentLatLng;
    return (
      <div
        style={{ height }}
        className="w-full rounded overflow-hidden shadow-sm"
      >
        <MapContainer
          center={center}
          zoom={10}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
          attributionControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <CircleMarker
            center={currentLatLng}
            radius={9}
            pathOptions={{
              fillColor: "#2563eb",
              color: "#fff",
              weight: 1,
              fillOpacity: 0.95,
            }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>
                Current location
              </div>
            </Tooltip>
          </CircleMarker>
        </MapContainer>
      </div>
    );
  }

  // split polylines: completed up to currentIndex, remaining from currentIndex
  const completed = latlngs.slice(
    0,
    Math.min(currentIndex + 1, latlngs.length)
  );
  const remaining = latlngs.slice(Math.max(currentIndex, 0));

  // initial center fallback
  const center = latlngs[0] || currentLatLng || [39.5, -98.35]; // center of US fallback

  return (
    <div
      style={{ height }}
      className="w-full rounded overflow-hidden shadow-sm"
    >
      <MapContainer
        center={center}
        zoom={5}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        attributionControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {bounds && <FitBounds latlngs={bounds} />}

        {/* Completed route */}
        {completed.length > 1 && (
          <Polyline
            positions={completed}
            pathOptions={{ color: "#16a34a", weight: 4, opacity: 0.95 }}
          />
        )}

        {/* Remaining route */}
        {remaining.length > 1 && (
          <Polyline
            positions={remaining}
            pathOptions={{
              color: "#9ca3af",
              weight: 3,
              dashArray: "6,8",
              opacity: 0.9,
            }}
          />
        )}

        {/* Checkpoint markers */}
        {route.map((cp, i) => {
          const coords = cp?.location?.coordinates;
          if (!coords) return null;
          const pos = [coords[1], coords[0]];
          const done = i <= currentIndex;
          return (
            <CircleMarker
              key={`${i}-${cp.city || i}`}
              center={pos}
              radius={done ? 7 : 5}
              pathOptions={{
                fillColor: done ? "#16a34a" : "#374151",
                color: "#ffffff",
                weight: 1,
                fillOpacity: 1,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{`${i + 1}. ${
                  cp.city || "Checkpoint"
                }`}</div>
                {cp.eta && (
                  <div style={{ fontSize: 11 }}>
                    {new Date(cp.eta).toLocaleString()}
                  </div>
                )}
              </Tooltip>
            </CircleMarker>
          );
        })}

        {/* Animated current location marker */}
        {currentLatLng && (
          <AnimatedMarker
            prev={prevLatLng}
            next={currentLatLng}
            radius={9}
            pathOptions={{
              fillColor: "#2563eb",
              color: "#fff",
              weight: 1,
              fillOpacity: 0.95,
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
