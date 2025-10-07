// /api/shared/routeGenerator.js
// Small demo city lookup + route generator for portfolio demo.

const CITY_LIST = [
  {
    city: "Los Angeles",
    state: "CA",
    zip: "90001",
    coords: [-118.2437, 34.0522],
  },
  { city: "Phoenix", state: "AZ", zip: "85001", coords: [-112.074, 33.4484] },
  { city: "Dallas", state: "TX", zip: "75201", coords: [-96.797, 32.7767] },
  { city: "Memphis", state: "TN", zip: "38101", coords: [-90.049, 35.1495] },
  { city: "Atlanta", state: "GA", zip: "30301", coords: [-84.388, 33.749] },
  { city: "Charlotte", state: "NC", zip: "28202", coords: [-80.8431, 35.2271] },
  { city: "New York", state: "NY", zip: "10001", coords: [-74.006, 40.7128] },
  {
    city: "San Diego",
    state: "CA",
    zip: "92101",
    coords: [-117.1611, 32.7157],
  },
  { city: "Chicago", state: "IL", zip: "60601", coords: [-87.6298, 41.8781] },
  { city: "Austin", state: "TX", zip: "73301", coords: [-97.7431, 30.2672] },
];

function findCityObj(name) {
  if (!name) return null;
  const norm = name.toLowerCase();
  return (
    CITY_LIST.find(
      (c) =>
        `${c.city}, ${c.state}`.toLowerCase() === norm ||
        c.city.toLowerCase() === norm
    ) || null
  );
}

export function generateRoute(originLabel, destLabel) {
  const origin = findCityObj(originLabel) || CITY_LIST[0];
  const dest = findCityObj(destLabel) || CITY_LIST[CITY_LIST.length - 1];

  const len = Math.max(3, Math.floor(Math.random() * 4) + 5); // 5-8 total
  // pick some intermediates (avoid origin/dest)
  const pool = CITY_LIST.filter(
    (c) => c.city !== origin.city && c.city !== dest.city
  );
  // random selection of (len - 2)
  const picks = [];
  while (picks.length < len - 2 && pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(idx, 1)[0]);
  }
  const full = [origin, ...picks, dest];
  const now = Date.now();
  return full.map((c, i) => ({
    city: `${c.city}, ${c.state}`,
    zip: c.zip,
    location: { type: "Point", coordinates: c.coords },
    eta: new Date(now + i * 24 * 60 * 60 * 1000).toISOString(), // +i days
  }));
}
