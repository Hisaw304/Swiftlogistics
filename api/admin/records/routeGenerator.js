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

    // ----- sampling + dedupe + correct labeling -----
    const totalCoords = coords.length;
    // target max checkpoints (including origin + destination)
    const TARGET_POINTS = 8; // tweak: 5..12 is reasonable
    // sampleRate as fallback (but we'll compute indexes smartly)
    const step = Math.max(1, Math.floor(totalCoords / TARGET_POINTS));

    // accumulate sampled entries preserving the original index so we can detect origin/dest
    const sampled = [];
    const minDistanceMeters = 80; // skip points closer than ~80m to previous kept (tweak)

    // quick helper: approximate distance (meters) between two lng/lat using equirectangular approx
    function approxMeters(aLng, aLat, bLng, bLat) {
      const toRad = Math.PI / 180;
      const x = (bLng - aLng) * Math.cos(((aLat + bLat) / 2) * toRad);
      const y = (bLat - aLat) * toRad;
      // Earth radius ~6371000 m
      return Math.sqrt(x * x + y * y) * 6371000;
    }

    // Always include first point
    sampled.push({ lng: coords[0][0], lat: coords[0][1], idx: 0 });
    let lastKept = coords[0];

    // pick intermediate points at `step` intervals but apply dedupe by distance
    for (let i = step; i < totalCoords - 1; i += step) {
      const [lng, lat] = coords[i];
      const dist = approxMeters(lastKept[0], lastKept[1], lng, lat);
      if (dist >= minDistanceMeters) {
        sampled.push({ lng, lat, idx: i });
        lastKept = [lng, lat];
      }
    }

    // ensure final point is included (destination)
    if (totalCoords > 1) {
      const last = coords[totalCoords - 1];
      // if last is too close to lastKept, replace it; else push
      const distLast = approxMeters(lastKept[0], lastKept[1], last[0], last[1]);
      if (distLast < 1) {
        // already identical; optionally skip
      } else {
        sampled.push({ lng: last[0], lat: last[1], idx: totalCoords - 1 });
      }
    }

    // build checkpoints; note we now have original indexes available as `idx`
    const checkpoints = sampled.map((p, i) => {
      const isOrigin = p.idx === 0;
      const isDest = p.idx === totalCoords - 1;
      return {
        city: isOrigin
          ? origin.city || "Origin"
          : isDest
          ? destination.city ||
            (destination.address && destination.address.full) ||
            "Destination"
          : `Stop ${i}`,
        location: { type: "Point", coordinates: [p.lng, p.lat] },
      };
    });

    return checkpoints;
  } catch (err) {
    console.error(
      "generateRoute: unexpected error",
      err && err.stack ? err.stack : String(err)
    );
    return [];
  }
}
