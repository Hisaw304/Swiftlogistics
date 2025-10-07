import React, { useEffect, useMemo } from "react";
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
 * RouteMap
 * props:
 *  - route: array of checkpoints with { city, zip?, location: { type: "Point", coordinates: [lng, lat] }, eta? }
 *  - currentIndex: integer (index into route)
 *  - currentLocation: GeoJSON Point { type: 'Point', coordinates: [lng, lat] } (optional)
 *  - height: px or CSS value (optional, default 320)
 */
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

export default function RouteMap({
  route = [],
  currentIndex = 0,
  currentLocation = null,
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
    const c = currentLocation?.coordinates;
    return c && c.length >= 2 ? [c[1], c[0]] : null;
  }, [currentLocation]);

  // bounds for fitBounds
  const bounds = useMemo(() => {
    const pts = [...latlngs];
    if (currentLatLng) pts.push(currentLatLng);
    return pts.length ? pts : null;
  }, [latlngs, currentLatLng]);

  if (!route || route.length === 0) {
    return (
      <div className="text-sm text-gray-500">No route data available.</div>
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
              key={`${i}-${cp.city}`}
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
                  cp.city
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

        {/* Current location marker */}
        {currentLatLng && (
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
        )}
      </MapContainer>
    </div>
  );
}
