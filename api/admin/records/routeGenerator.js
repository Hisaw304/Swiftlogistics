// pages/api/admin/records/routeGenerator.js
// Hardened ORS route generator — safe runtime checks, dynamic fetch import, defensive abort handling

/**
 * Decode Google's encoded polyline to array of [lng, lat] pairs.
 * Returns array like: [[lng, lat], [lng, lat], ...]
 */
function decodePolyline(encoded) {
  let index = 0,
    lat = 0,
    lng = 0,
    coordinates = [];
  const str = String(encoded || "");
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
 * Helper to get a fetch function that works both in Node 18+ (global fetch)
 * and when node-fetch is required.
 */
async function getFetch() {
  if (typeof fetch === "function") return fetch;
  // dynamic import to avoid module resolution errors at startup
  try {
    const mod = await import("node-fetch");
    // node-fetch v3 default export is the fetch function
    return mod.default || mod;
  } catch (err) {
    throw new Error(
      "No fetch available in runtime and failed to import node-fetch"
    );
  }
}

/**
 * Safe helper to create AbortController if available.
 */
function tryCreateAbortController(timeoutMs = 10000) {
  let controller = null;
  try {
    if (typeof AbortController !== "undefined") {
      controller = new AbortController();
      const t = setTimeout(() => {
        try {
          controller.abort();
        } catch {}
      }, timeoutMs);
      return { controller, clear: () => clearTimeout(t) };
    }
  } catch (e) {
    // ignore - AbortController not available
  }
  return { controller: null, clear: () => {} };
}

/**
 * Generate route checkpoints using OpenRouteService Directions API
 * @param {Object} origin - { lat, lng, city }
 * @param {Object} destination - { lat, lng, city }
 * @returns {Promise<Array>} route checkpoints [{ city, location: { type:'Point', coordinates:[lng,lat] } }]
 */
export async function generateRoute(origin, destination) {
  try {
    // defensive input check
    if (
      !origin ||
      !destination ||
      !Number.isFinite(Number(origin.lat)) ||
      !Number.isFinite(Number(origin.lng)) ||
      !Number.isFinite(Number(destination.lat)) ||
      !Number.isFinite(Number(destination.lng))
    ) {
      console.warn("generateRoute: invalid origin/destination", {
        origin,
        destination,
      });
      return [];
    }

    const ORS_KEY = process.env.ORS_API_KEY;
    if (!ORS_KEY) {
      console.error("generateRoute: ORS_API_KEY not set");
      return [];
    }

    const _fetch = await getFetch();

    const url = `https://api.openrouteservice.org/v2/directions/driving-car`;
    // Request GeoJSON directly (ORS accepts format in body for POST)
    const body = {
      coordinates: [
        [Number(origin.lng), Number(origin.lat)],
        [Number(destination.lng), Number(destination.lat)],
      ],
      format: "geojson",
    };

    const { controller, clear } = tryCreateAbortController(10000);

    const res = await _fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: ORS_KEY,
        Accept: "application/json, application/geo+json",
      },
      body: JSON.stringify(body),
      ...(controller ? { signal: controller.signal } : {}),
    });

    clear();

    const text = await res.text();
    if (!res.ok) {
      console.error(
        `ORS API returned ${res.status}: ${text.substring(0, 1000)}`
      );
      return [];
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("generateRoute: failed to parse ORS response JSON", err);
      return [];
    }

    // parse coordinates from ORS response: be flexible
    let coords = [];
    if (data?.routes?.[0]?.geometry) {
      const geom = data.routes[0].geometry;
      if (typeof geom === "object" && Array.isArray(geom.coordinates)) {
        coords = geom.coordinates;
      } else if (typeof geom === "string" && geom.length > 0) {
        coords = decodePolyline(geom);
      }
    } else if (data?.features?.[0]?.geometry?.coordinates) {
      coords = data.features[0].geometry.coordinates;
    } else {
      console.warn(
        "generateRoute: no route geometry found in ORS response",
        data
      );
      return [];
    }

    if (!Array.isArray(coords) || coords.length === 0) {
      console.warn(
        "generateRoute: coordinates empty after parsing ORS response"
      );
      return [];
    }

    // sampling: keep route modest size
    const sampleRate = Math.max(1, Math.floor(coords.length / 50)); // ~50 points
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
    console.error(
      "generateRoute: unexpected error",
      err && err.stack ? err.stack : String(err)
    );
    return [];
  }
}
