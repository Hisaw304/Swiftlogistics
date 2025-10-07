// src/lib/routeGenerator.js
import cities from "./cityCoords.json";

function findCity(nameOrCityState) {
  if (!nameOrCityState) return null;
  const n = nameOrCityState.toLowerCase();
  return (
    cities.find(
      (c) =>
        `${c.city}, ${c.state}`.toLowerCase() === n ||
        c.city.toLowerCase() === n
    ) || null
  );
}

function pickIntermediates(origin, dest, count) {
  const pool = cities.filter(
    (c) => c.city !== origin.city && c.city !== dest.city
  );
  const picks = [];
  while (picks.length < count && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(i, 1)[0]);
  }
  return picks;
}

/**
 * generateRoute(originLabel, destLabel)
 * - originLabel/destLabel: "City, ST" or "City"
 * - returns array of checkpoints [{ city, zip, location:{type:"Point",coordinates:[lng,lat]}, eta }]
 */
export function generateRoute(
  originLabel = "Los Angeles",
  destLabel = "New York"
) {
  const origin = findCity(originLabel) || cities[0];
  const dest = findCity(destLabel) || cities[cities.length - 1];
  const total = Math.floor(Math.random() * 4) + 5; // 5-8
  const intermediates = pickIntermediates(origin, dest, total - 2);
  const full = [origin, ...intermediates, dest];
  const base = Date.now();
  return full.map((c, i) => ({
    city: `${c.city}, ${c.state}`,
    zip: c.zip,
    location: { type: "Point", coordinates: c.coords },
    eta: new Date(base + i * 24 * 60 * 60 * 1000).toISOString(),
  }));
}
