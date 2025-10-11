import React, { useState, useEffect } from "react";
import ImageUploader from "./ImageUploader";

/*
 Props:
  - onCreate(payload)
  - onUpdate(id, payload)
  - initial (optional)
  - mode: "create" | "edit"
  - onCancel (optional)
*/

function hasAnyAddressField(addr) {
  return !!(addr && (addr.full || addr.city || addr.zip));
}

function safeIdFromInitial(init) {
  if (!init) return null;
  if (init.trackingId) return String(init.trackingId);
  if (init._id) return String(init._id);
  if (init.id) return String(init.id);
  return null;
}

export default function AdminForm({
  onCreate,
  onUpdate,
  initial = null,
  mode = "create",
  onCancel,
}) {
  // Shipment details
  const [serviceType, setServiceType] = useState(
    initial?.serviceType || "standard"
  );
  const [shipmentDetails, setShipmentDetails] = useState(
    initial?.shipmentDetails || ""
  );
  const [productDescription, setProductDescription] = useState(
    initial?.productDescription || initial?.product || ""
  );
  const [quantity, setQuantity] = useState(initial?.quantity ?? 1);
  const [weightKg, setWeightKg] = useState(initial?.weightKg ?? "");
  const [description, setDescription] = useState(initial?.description || "");

  // Origin
  const [originName, setOriginName] = useState(initial?.origin?.name || "");
  const [originAddressFull, setOriginAddressFull] = useState(
    initial?.origin?.address?.full || ""
  );
  const [originCity, setOriginCity] = useState(
    initial?.origin?.address?.city || ""
  );
  const [originState, setOriginState] = useState(
    initial?.origin?.address?.state || ""
  );
  const [originZip, setOriginZip] = useState(
    initial?.origin?.address?.zip || ""
  );
  const [originLat, setOriginLat] = useState(
    initial?.origin?.location?.coordinates?.[1] ?? ""
  );
  const [originLng, setOriginLng] = useState(
    initial?.origin?.location?.coordinates?.[0] ?? ""
  );

  // Destination
  const [receiverName, setReceiverName] = useState(
    initial?.destination?.receiverName || ""
  );
  const [receiverEmail, setReceiverEmail] = useState(
    initial?.destination?.receiverEmail || ""
  );
  const [destAddressFull, setDestAddressFull] = useState(
    initial?.destination?.address?.full || initial?.address?.full || ""
  );
  const [destCity, setDestCity] = useState(
    initial?.destination?.address?.city || initial?.address?.city || ""
  );
  const [destState, setDestState] = useState(
    initial?.destination?.address?.state || initial?.address?.state || ""
  );
  const [destZip, setDestZip] = useState(
    initial?.destination?.address?.zip || initial?.address?.zip || ""
  );
  const [destLat, setDestLat] = useState(
    initial?.destination?.location?.coordinates?.[1] ?? ""
  );
  const [destLng, setDestLng] = useState(
    initial?.destination?.location?.coordinates?.[0] ?? ""
  );
  const [destExpectedDeliveryDate, setDestExpectedDeliveryDate] = useState(
    initial?.destination?.expectedDeliveryDate
      ? initial.destination.expectedDeliveryDate.slice(0, 10)
      : initial?.expectedDeliveryDate
      ? initial.expectedDeliveryDate.slice(0, 10)
      : ""
  );

  // Dates & status
  const [shipmentDate, setShipmentDate] = useState(
    initial?.shipmentDate ? initial.shipmentDate.slice(0, 10) : ""
  );
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    initial?.expectedDeliveryDate
      ? initial.expectedDeliveryDate.slice(0, 10)
      : destExpectedDeliveryDate || ""
  );

  const [status, setStatus] = useState(initial?.status || "Pending");
  // Be resilient to different legacy image field names
  const [imageUrl, setImageUrl] = useState(
    initial?.imageUrl ||
      initial?.image ||
      initial?.photo ||
      initial?.image_url ||
      null
  );
  // derived/route state (paste right after imageUrl state)
  const [route, setRoute] = useState(initial?.route || []);
  const [currentIndex, setCurrentIndex] = useState(initial?.currentIndex ?? 0);
  const [progressPct, setProgressPct] = useState(initial?.progressPct ?? 0);
  const [currentLocation, setCurrentLocation] = useState(
    initial?.currentLocation || initial?.origin?.location || null
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initial) {
      setServiceType(initial.serviceType || "standard");
      setShipmentDetails(initial.shipmentDetails || "");
      setProductDescription(
        initial.productDescription || initial?.product || ""
      );
      setQuantity(initial.quantity ?? 1);
      setWeightKg(initial.weightKg ?? "");
      setDescription(initial.description || "");
      setOriginName(initial.origin?.name || "");
      setOriginAddressFull(initial.origin?.address?.full || "");
      setOriginCity(initial.origin?.address?.city || "");
      setOriginState(initial.origin?.address?.state || "");
      setOriginZip(initial.origin?.address?.zip || "");
      setOriginLat(initial.origin?.location?.coordinates?.[1] ?? "");
      setOriginLng(initial.origin?.location?.coordinates?.[0] ?? "");
      setReceiverName(initial.destination?.receiverName || "");
      setReceiverEmail(initial.destination?.receiverEmail || "");
      setDestAddressFull(
        initial.destination?.address?.full || initial?.address?.full || ""
      );
      setDestCity(
        initial.destination?.address?.city || initial?.address?.city || ""
      );
      setDestState(
        initial.destination?.address?.state || initial?.address?.state || ""
      );
      setDestZip(
        initial.destination?.address?.zip || initial?.address?.zip || ""
      );
      setDestLat(initial.destination?.location?.coordinates?.[1] ?? "");
      setDestLng(initial.destination?.location?.coordinates?.[0] ?? "");
      setDestExpectedDeliveryDate(
        initial.destination?.expectedDeliveryDate
          ? initial.destination.expectedDeliveryDate.slice(0, 10)
          : initial?.expectedDeliveryDate
          ? initial.expectedDeliveryDate.slice(0, 10)
          : ""
      );
      setShipmentDate(
        initial.shipmentDate ? initial.shipmentDate.slice(0, 10) : ""
      );
      setExpectedDeliveryDate(
        initial.expectedDeliveryDate
          ? initial.expectedDeliveryDate.slice(0, 10)
          : destExpectedDeliveryDate || ""
      );
      setStatus(initial.status || "Pending");
      // support legacy keys for image (image, imageUrl, photo, image_url)
      setImageUrl(
        initial.imageUrl ||
          initial.image ||
          initial.photo ||
          initial.image_url ||
          null
      );
      // compute derived values from initial and set local derived state
      const initialDerived = computeDerived({
        route: initial?.route || [],
        currentIndex: initial?.currentIndex ?? 0,
        status: initial?.status || "Pending",
        shipmentDate: initial?.shipmentDate || null,
        origin: initial?.origin || null,
      });
      setProgressPct(initialDerived.progressPct);
      setCurrentIndex(initialDerived.currentIndex);
      setCurrentLocation(initialDerived.currentLocation);
      if (initialDerived.shipmentDate) {
        // convert ISO -> YYYY-MM-DD for the date input
        setShipmentDate(initialDerived.shipmentDate.slice(0, 10));
      }
    }
  }, [initial]);

  // Helpers
  function buildGeoPoint(lat, lng) {
    if (!lat && !lng) return null;
    const la = lat === "" ? null : Number(lat);
    const lo = lng === "" ? null : Number(lng);
    if (Number.isFinite(la) && Number.isFinite(lo)) {
      return { type: "Point", coordinates: [lo, la] };
    }
    return null;
  }
  function computeDerived({
    route = [],
    currentIndex = 0,
    status = "Pending",
    shipmentDate = null,
    origin = null,
  }) {
    const routeArr = Array.isArray(route) ? route : [];
    let idx = Number.isFinite(Number(currentIndex)) ? Number(currentIndex) : 0;
    idx = Math.max(0, idx);

    const totalStops = routeArr.length;
    let progressPct =
      totalStops > 1 ? Math.round((idx / (totalStops - 1)) * 100) : 0;

    const st = String(status || "Pending")
      .trim()
      .toLowerCase();

    const shipmentISO = shipmentDate
      ? new Date(shipmentDate).toISOString()
      : null;
    const nowIso = new Date().toISOString();
    const computedShipmentDate =
      st === "shipped" ? shipmentISO || nowIso : shipmentISO;

    if (st === "delivered") {
      if (Array.isArray(routeArr) && routeArr.length > 0) {
        idx = Math.max(0, routeArr.length - 1);
      }
      progressPct = 100;
    } else {
      if (totalStops > 1) {
        progressPct = Math.round((idx / (totalStops - 1)) * 100);
      } else {
        progressPct = progressPct ?? 0;
      }
    }

    let currentLocation = null;
    if (routeArr && routeArr[idx] && routeArr[idx].location) {
      currentLocation = routeArr[idx].location;
    } else if (origin && origin.location) {
      currentLocation = origin.location;
    }

    return {
      currentIndex: idx,
      progressPct,
      shipmentDate: computedShipmentDate,
      currentLocation,
    };
  }

  function validateEmail(e) {
    if (!e) return true;
    // simple email check
    return /\S+@\S+\.\S+/.test(e);
  }

  // Submit handler
  async function submit(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // basic client-side validation
      if (receiverEmail && !validateEmail(receiverEmail)) {
        throw new Error("Invalid receiver email");
      }
      if (quantity < 1) throw new Error("Quantity must be at least 1");
      if (weightKg !== "" && Number(weightKg) < 0)
        throw new Error("Weight must be >= 0");
      if (
        shipmentDate &&
        expectedDeliveryDate &&
        shipmentDate > expectedDeliveryDate
      ) {
        throw new Error("Shipment date cannot be after expected delivery date");
      }

      // build payload minimally
      const payload = {};

      // Shipment summary
      if (serviceType) payload.serviceType = serviceType;
      if (shipmentDetails) payload.shipmentDetails = shipmentDetails;
      if (productDescription) payload.productDescription = productDescription;
      if (quantity !== undefined && quantity !== null)
        payload.quantity = Number(quantity);
      if (weightKg !== "" && weightKg !== null)
        payload.weightKg = Number(weightKg);
      if (description) payload.description = description;

      // Origin nested object
      if (
        originName ||
        hasAnyAddressField({
          full: originAddressFull,
          city: originCity,
          zip: originZip,
        }) ||
        originLat ||
        originLng
      ) {
        const origin = {};
        if (originName) origin.name = originName;
        origin.address = {};
        if (originAddressFull) origin.address.full = originAddressFull;
        if (originCity) origin.address.city = originCity;
        if (originState) origin.address.state = originState;
        if (originZip) origin.address.zip = originZip;
        const gl = buildGeoPoint(originLat, originLng);
        if (gl) origin.location = gl;
        payload.origin = origin;
      }

      // Destination nested object
      if (
        receiverName ||
        receiverEmail ||
        hasAnyAddressField({
          full: destAddressFull,
          city: destCity,
          zip: destZip,
        }) ||
        destLat ||
        destLng ||
        destExpectedDeliveryDate
      ) {
        const destination = {};
        if (receiverName) destination.receiverName = receiverName;
        if (receiverEmail) destination.receiverEmail = receiverEmail;
        destination.address = {};
        if (destAddressFull) destination.address.full = destAddressFull;
        if (destCity) destination.address.city = destCity;
        if (destState) destination.address.state = destState;
        if (destZip) destination.address.zip = destZip;
        const dl = buildGeoPoint(destLat, destLng);
        if (dl) destination.location = dl;
        if (destExpectedDeliveryDate)
          destination.expectedDeliveryDate = new Date(
            destExpectedDeliveryDate
          ).toISOString();
        payload.destination = destination;
      }

      // Dates & status
      if (shipmentDate)
        payload.shipmentDate = new Date(shipmentDate).toISOString();
      if (expectedDeliveryDate)
        payload.expectedDeliveryDate = new Date(
          expectedDeliveryDate
        ).toISOString();
      if (status) payload.status = status;

      // include image under both keys so server/back-compat handles it
      if (imageUrl) {
        payload.imageUrl = imageUrl;
        payload.image = imageUrl;
      }

      // --- compute derived fields from current form state BEFORE sending to server ---
      const derived = computeDerived({
        route,
        currentIndex,
        status,
        // shipmentDate is a local YYYY-MM-DD string; convert to ISO for computeDerived
        shipmentDate: shipmentDate
          ? new Date(shipmentDate).toISOString()
          : null,
        // prefer the origin we just built into payload (if any), otherwise fall back to initial
        origin: payload.origin || initial?.origin || null,
      });

      // include route if present
      if (Array.isArray(route) && route.length) payload.route = route;

      // attach derived values so server persists them
      payload.currentIndex = derived.currentIndex;
      payload.progressPct = derived.progressPct;
      if (derived.currentLocation)
        payload.currentLocation = derived.currentLocation;
      if (derived.shipmentDate) payload.shipmentDate = derived.shipmentDate;

      // help server pick origin/destination labels (optional but useful)
      if (originCity) payload.originWarehouse = originCity;
      if (destCity) payload.destinationCity = destCity;

      // Call parent handlers and adopt server-returned route/derived fields
      if (mode === "create") {
        // Parent should return the created document
        const created = await onCreate(payload);
        // If server returned route / derived values, adopt them into form state
        if (created) {
          if (Array.isArray(created.route)) setRoute(created.route);
          if (typeof created.currentIndex === "number")
            setCurrentIndex(created.currentIndex);
          if (typeof created.progressPct === "number")
            setProgressPct(created.progressPct);
          if (created.currentLocation)
            setCurrentLocation(created.currentLocation);
          if (created.shipmentDate)
            setShipmentDate(created.shipmentDate.slice(0, 10));
        }
      } else if (mode === "edit" && onUpdate && initial) {
        const idToSend = safeIdFromInitial(initial);
        if (!idToSend)
          throw new Error(
            "Missing record id: trackingId or _id required for update"
          );

        console.log("AdminForm: update call:", { idToSend, payload });

        // Parent should return the updated document
        const updated = await onUpdate(idToSend, payload);

        if (updated) {
          if (Array.isArray(updated.route)) setRoute(updated.route);
          if (typeof updated.currentIndex === "number")
            setCurrentIndex(updated.currentIndex);
          if (typeof updated.progressPct === "number")
            setProgressPct(updated.progressPct);
          if (updated.currentLocation)
            setCurrentLocation(updated.currentLocation);
          if (updated.shipmentDate)
            setShipmentDate(updated.shipmentDate.slice(0, 10));
        }
      }
    } catch (err) {
      console.error("❌ Save failed (AdminForm):", err);
      setError(err?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }
  // Automatically fetch coordinates for origin or destination
  async function geocodeAddress(address, setLat, setLng) {
    if (!address) return;

    try {
      const res = await fetch(
        `/api/geocode?address=${encodeURIComponent(address)}`
      );
      const data = await res.json();

      if (data?.features?.[0]?.geometry?.coordinates) {
        const [lng, lat] = data.features[0].geometry.coordinates;
        setLat(lat);
        setLng(lng);
        console.log("✅ Geocoded:", address, lat, lng);
      } else {
        console.warn("⚠️ No coordinates found for", address);
      }
    } catch (err) {
      console.error("❌ Geocoding error:", err);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="admin-form bg-white p-6 rounded-xl shadow space-y-6"
    >
      {/* Top form heading (centered) */}
      <h2 className="form-heading text-center text-2xl md:text-3xl font-bold">
        Shipment Administration Form
      </h2>

      <div className="grid grid-cols-1 gap-6">
        {/* Shipment Details Card */}
        <div className="form-card bg-gray-50 p-4 rounded-xl">
          <h3 className="card-title">Shipment Details</h3>

          <div className="space-y-3">
            <label className="block text-sm">
              <div className="label-text">Service type</div>
              <select
                className="mt-1 p-3 w-full border rounded form-select"
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
              >
                <option value="standard">Standard</option>
                <option value="express">Express</option>
                <option value="courier">Courier</option>
                <option value="same_day">Same day</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="block text-sm">
              <div className="label-text">Product description</div>
              <input
                className="mt-1 p-3 w-full border rounded form-input"
                placeholder="Product name / short desc"
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                required
              />
            </label>

            <div className="flex gap-3">
              <label className="flex-1 text-sm">
                <div className="label-text">Quantity</div>
                <input
                  type="number"
                  min="1"
                  className="mt-1 p-3 w-full border rounded form-input"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </label>

              <label className="w-40 text-sm">
                <div className="label-text">Weight (kg)</div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1 p-3 w-full border rounded form-input"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />
              </label>
            </div>

            <label className="block text-sm">
              <div className="label-text">Shipment notes</div>
              <textarea
                className="mt-1 p-3 w-full border rounded form-input"
                value={shipmentDetails}
                onChange={(e) => setShipmentDetails(e.target.value)}
                rows={3}
              />
            </label>

            <label className="block text-sm">
              <div className="label-text">Internal description</div>
              <textarea
                className="mt-1 p-3 w-full border rounded form-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </label>
          </div>
        </div>

        {/* Origin Card */}
        <div className="form-card bg-gray-50 p-4 rounded-xl shadow-sm space-y-3">
          <h3 className="card-title">Origin (Sender)</h3>

          <label className="block text-sm">
            <div className="label-text">Sender name</div>
            <input
              className="mt-1 p-3 w-full border rounded form-input"
              value={originName}
              onChange={(e) => setOriginName(e.target.value)}
              placeholder="John Doe"
            />
          </label>

          <label className="block text-sm">
            <div className="label-text">Street address</div>
            <input
              className="mt-1 p-3 w-full border rounded form-input"
              value={originAddressFull}
              onChange={(e) => setOriginAddressFull(e.target.value)}
              onBlur={() =>
                geocodeAddress(originAddressFull, setOriginLat, setOriginLng)
              }
              placeholder="123 Main St"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              className="p-3 border rounded w-full form-input"
              placeholder="City"
              value={originCity}
              onChange={(e) => setOriginCity(e.target.value)}
            />
            <input
              className="p-3 border rounded w-full form-input"
              placeholder="State"
              value={originState}
              onChange={(e) => setOriginState(e.target.value)}
            />
            <input
              className="p-3 border rounded w-full form-input"
              placeholder="ZIP"
              value={originZip}
              onChange={(e) => setOriginZip(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              className="p-3 border rounded w-full form-input"
              placeholder="Latitude"
              value={originLat}
              onChange={(e) => setOriginLat(e.target.value)}
            />
            <input
              className="p-3 border rounded w-full form-input"
              placeholder="Longitude"
              value={originLng}
              onChange={(e) => setOriginLng(e.target.value)}
            />
          </div>
        </div>

        {/* Destination Card */}
        <div className="form-card bg-gray-50 p-4 rounded-xl shadow-sm space-y-3">
          <h3 className="card-title">Destination (Receiver)</h3>

          <label className="block text-sm">
            <div className="label-text">Receiver name</div>
            <input
              className="mt-1 p-3 w-full border rounded form-input"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              placeholder="Jane Smith"
            />
          </label>

          <label className="block text-sm">
            <div className="label-text">Receiver email</div>
            <input
              type="email"
              className="mt-1 p-3 w-full border rounded form-input"
              value={receiverEmail}
              onChange={(e) => setReceiverEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </label>

          <label className="block text-sm">
            <div className="label-text">Street address</div>
            <input
              className="mt-1 p-3 w-full border rounded form-input"
              value={destAddressFull}
              onChange={(e) => setDestAddressFull(e.target.value)}
              onBlur={() =>
                geocodeAddress(destAddressFull, setDestLat, setDestLng)
              }
              placeholder="456 Elm Ave"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              className="p-3 border rounded w-full form-input"
              placeholder="City"
              value={destCity}
              onChange={(e) => setDestCity(e.target.value)}
            />
            <input
              className="p-3 border rounded w-full form-input"
              placeholder="State"
              value={destState}
              onChange={(e) => setDestState(e.target.value)}
            />
            <input
              className="p-3 border rounded w-full form-input"
              placeholder="ZIP"
              value={destZip}
              onChange={(e) => setDestZip(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              className="p-3 border rounded w-full form-input"
              placeholder="Latitude"
              value={destLat}
              onChange={(e) => setDestLat(e.target.value)}
            />
            <input
              className="p-3 border rounded w-full form-input"
              placeholder="Longitude"
              value={destLng}
              onChange={(e) => setDestLng(e.target.value)}
            />
          </div>

          <label className="block text-sm">
            <div className="label-text">Expected delivery date</div>
            <input
              type="date"
              className="mt-1 p-3 w-full border rounded form-input"
              value={destExpectedDeliveryDate}
              onChange={(e) => setDestExpectedDeliveryDate(e.target.value)}
            />
          </label>
        </div>
      </div>

      {/* Dates, Image, Status and Actions row */}
      <div className="grid grid-cols-1 gap-4">
        <div className="form-card bg-gray-50 p-4 rounded-xl">
          <h4 className="card-title small">Dates</h4>

          <label className="block text-sm mb-2">
            <div className="label-text">Shipment date</div>
            <input
              type="date"
              className="mt-1 p-3 w-full border rounded form-input"
              value={shipmentDate}
              onChange={(e) => setShipmentDate(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            <div className="label-text">Expected delivery</div>
            <input
              type="date"
              className="mt-1 p-3 w-full border rounded form-input"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
            />
          </label>
        </div>

        <div className="form-card bg-gray-50 p-4 rounded-xl">
          <h4 className="card-title small">Image</h4>
          <ImageUploader
            initialUrl={imageUrl}
            onUploadComplete={(u) => setImageUrl(u)}
          />
        </div>

        <div className="form-card bg-gray-50 p-4 rounded-xl">
          <h4 className="card-title small">Status & Actions</h4>
          <div className="space-y-3">
            <select
              className="p-3 w-full border rounded form-select"
              value={status}
              onChange={(e) => {
                const newStatus = e.target.value;
                setStatus(newStatus);

                const d = computeDerived({
                  route,
                  currentIndex,
                  status: newStatus,
                  shipmentDate, // local YYYY-MM-DD input; computeDerived will convert
                  origin: initial?.origin || null,
                });

                // preserve your original behavior
                setProgressPct(d.progressPct);
                if (d.currentIndex !== currentIndex)
                  setCurrentIndex(d.currentIndex);
                setCurrentLocation(d.currentLocation || null);
                if (d.shipmentDate)
                  setShipmentDate(d.shipmentDate.slice(0, 10));
              }}
            >
              <option>Pending</option>
              <option>On Hold</option>
              <option>Shipped</option>
              <option>Out for Delivery</option>
              <option>Delivered</option>
              <option>Exception</option>
            </select>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 btn-primary rounded"
              >
                {saving
                  ? "Saving..."
                  : mode === "create"
                  ? "Create Record"
                  : "Save"}
              </button>

              {mode === "edit" && (
                <button
                  type="button"
                  className="px-3 py-2 btn-secondary rounded"
                  onClick={onCancel}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="text-xs text-red-600">{error}</div>}
    </form>
  );
}
