// pages/api/admin/records/routeGenerator.js
import fetch from "node-fetch";

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

  try {
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${process.env.ORS_API_KEY}`;
    const body = {
      coordinates: [
        [origin.lng, origin.lat],
        [destination.lng, destination.lat],
      ],
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      console.error("ORS API failed", await res.text());
      return [];
    }

    const data = await res.json();
    const coords = data.features?.[0]?.geometry?.coordinates || [];

    // Sample route points: pick every ~5th point to reduce density
    const checkpoints = coords
      .filter((_, idx) => idx % 5 === 0 || idx === coords.length - 1)
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
    console.error("Error generating route:", err);
    return [];
  }
}
