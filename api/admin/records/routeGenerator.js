// pages/api/admin/records/routeGenerator.js
import fetch from "node-fetch";

/**
 * Decode Google's encoded polyline to array of [lng, lat] pairs.
 * Returns array like: [[lng, lat], [lng, lat], ...]
 */
function decodePolyline(encoded) {
  let index = 0,
    lat = 0,
    lng = 0,
    coordinates = [];
  const str = encoded;
  while (index < str.length) {
    let b,
      shift = 0,
      result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    // NOTE: Google polyline precision default is 1e5:
    coordinates.push([lng / 1e5, lat / 1e5]); // return [lng, lat] to match your code
  }
  return coordinates;
}

/**
 * Generate route checkpoints using OpenRouteService Directions API
 * @param {Object} origin - { lat, lng, city }
 * @param {Object} destination - { lat, lng, city }
 * @returns {Promise<Array>} route checkpoints [{ city, location: { type:'Point', coordinates:[lng,lat] } }]
 */
export async function generateRoute(origin, destination) {
  if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
    console.warn("generateRoute: Missing lat/lng");
    return [];
  }

  const ORS_KEY = process.env.ORS_API_KEY;
  if (!ORS_KEY) {
    console.error("generateRoute: ORS_API_KEY not set");
    return [];
  }

  const url = `https://api.openrouteservice.org/v2/directions/driving-car`;
  // Request GeoJSON directly by setting format: "geojson" in body
  const body = {
    coordinates: [
      [origin.lng, origin.lat],
      [destination.lng, destination.lat],
    ],
    format: "geojson", // <--- ask ORS to return GeoJSON coordinates
  };

  const controller = new AbortController();
  const timeoutMs = 10000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: ORS_KEY,
        Accept: "application/json, application/geo+json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await res.text();
    if (!res.ok) {
      console.error(
        `ORS API returned ${res.status}: ${text.substring(0, 1000)}`
      );
      return [];
    }

    // parse JSON after we've read text (already read above)
    const data = JSON.parse(text);

    // ORS responses vary depending on format: try GeoJSON routes->geometry->coordinates first
    let coords = [];
    if (data?.routes?.[0]?.geometry) {
      // If format=geojson, geometry is an object with coordinates array
      if (
        typeof data.routes[0].geometry === "object" &&
        Array.isArray(data.routes[0].geometry.coordinates)
      ) {
        coords = data.routes[0].geometry.coordinates; // array of [lng, lat] pairs
      } else if (typeof data.routes[0].geometry === "string") {
        // encoded polyline string -> decode
        coords = decodePolyline(data.routes[0].geometry);
      }
    } else if (data?.features?.[0]?.geometry?.coordinates) {
      // older GeoJSON style
      coords = data.features[0].geometry.coordinates;
    } else {
      console.warn("generateRoute: no route geometry found in ORS response");
      return [];
    }

    if (!coords.length) {
      console.warn(
        "generateRoute: coordinates empty after parsing ORS response"
      );
      return [];
    }

    // sample points so output isn't huge
    const sampleRate = Math.max(1, Math.floor(coords.length / 50)); // aim ~50 points
    const checkpoints = coords
      .filter((_, idx) => idx % sampleRate === 0 || idx === coords.length - 1)
      .map(([lng, lat], i) => ({
        city:
          i === 0
            ? origin.city || "Origin"
            : i === coords.length - 1
            ? destination.city || "Destination"
            : `Stop ${i}`,
        location: { type: "Point", coordinates: [lng, lat] },
      }));

    return checkpoints;
  } catch (err) {
    if (err.name === "AbortError") {
      console.error("generateRoute: request timed out");
    } else {
      console.error("generateRoute: unexpected error", err);
    }
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
