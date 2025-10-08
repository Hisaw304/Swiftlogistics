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

      // Call parent handlers
      if (mode === "create") {
        await onCreate(payload);
      } else if (mode === "edit" && onUpdate && initial) {
        const idToSend = safeIdFromInitial(initial);
        if (!idToSend)
          throw new Error(
            "Missing record id: trackingId or _id required for update"
          );
        console.log("AdminForm: update call:", { idToSend, payload });
        await onUpdate(idToSend, payload);
      }
    } catch (err) {
      console.error("❌ Save failed (AdminForm):", err);
      setError(err?.message || "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white p-4 rounded shadow space-y-4">
      <div className="grid grid-cols-1 gap-4">
        {/* Shipment Details Card */}
        <div className="bg-gray-50 p-4 rounded border">
          <h3 className="font-semibold mb-2">Shipment Details</h3>
          <div className="space-y-2">
            <label className="block text-sm">
              Service type
              <select
                className="mt-1 p-2 w-full border rounded"
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
              Product description
              <input
                className="mt-1 p-2 w-full border rounded"
                placeholder="Product name / short desc"
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                required
              />
            </label>

            <div className="flex gap-2">
              <label className="flex-1 text-sm">
                Quantity
                <input
                  type="number"
                  min="1"
                  className="mt-1 p-2 w-full border rounded"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </label>

              <label className="w-40 text-sm">
                Weight (kg)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="mt-1 p-2 w-full border rounded"
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                />
              </label>
            </div>

            <label className="block text-sm">
              Shipment notes
              <textarea
                className="mt-1 p-2 w-full border rounded"
                value={shipmentDetails}
                onChange={(e) => setShipmentDetails(e.target.value)}
                rows={3}
              />
            </label>

            <label className="block text-sm">
              Internal description
              <textarea
                className="mt-1 p-2 w-full border rounded"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </label>
          </div>
        </div>

        {/* Origin Card */}
        <div className="bg-gray-50 p-4 rounded-xl border shadow-sm space-y-3">
          <h3 className="font-semibold text-lg mb-2">Origin (Sender)</h3>

          <label className="block text-sm">
            Sender name
            <input
              className="mt-1 p-2 w-full border rounded"
              value={originName}
              onChange={(e) => setOriginName(e.target.value)}
              placeholder="John Doe"
            />
          </label>

          <label className="block text-sm">
            Street address
            <input
              className="mt-1 p-2 w-full border rounded"
              value={originAddressFull}
              onChange={(e) => setOriginAddressFull(e.target.value)}
              placeholder="123 Main St"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              className="p-2 border rounded w-full"
              placeholder="City"
              value={originCity}
              onChange={(e) => setOriginCity(e.target.value)}
            />
            <input
              className="p-2 border rounded w-full"
              placeholder="State"
              value={originState}
              onChange={(e) => setOriginState(e.target.value)}
            />
            <input
              className="p-2 border rounded w-full"
              placeholder="ZIP"
              value={originZip}
              onChange={(e) => setOriginZip(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              className="p-2 border rounded w-full"
              placeholder="Latitude"
              value={originLat}
              onChange={(e) => setOriginLat(e.target.value)}
            />
            <input
              className="p-2 border rounded w-full"
              placeholder="Longitude"
              value={originLng}
              onChange={(e) => setOriginLng(e.target.value)}
            />
          </div>
        </div>

        {/* Destination Card */}
        <div className="bg-gray-50 p-4 rounded-xl border shadow-sm space-y-3">
          <h3 className="font-semibold text-lg mb-2">Destination (Receiver)</h3>

          <label className="block text-sm">
            Receiver name
            <input
              className="mt-1 p-2 w-full border rounded"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              placeholder="Jane Smith"
            />
          </label>

          <label className="block text-sm">
            Receiver email
            <input
              type="email"
              className="mt-1 p-2 w-full border rounded"
              value={receiverEmail}
              onChange={(e) => setReceiverEmail(e.target.value)}
              placeholder="jane@example.com"
            />
          </label>

          <label className="block text-sm">
            Street address
            <input
              className="mt-1 p-2 w-full border rounded"
              value={destAddressFull}
              onChange={(e) => setDestAddressFull(e.target.value)}
              placeholder="456 Elm Ave"
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              className="p-2 border rounded w-full"
              placeholder="City"
              value={destCity}
              onChange={(e) => setDestCity(e.target.value)}
            />
            <input
              className="p-2 border rounded w-full"
              placeholder="State"
              value={destState}
              onChange={(e) => setDestState(e.target.value)}
            />
            <input
              className="p-2 border rounded w-full"
              placeholder="ZIP"
              value={destZip}
              onChange={(e) => setDestZip(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              className="p-2 border rounded w-full"
              placeholder="Latitude"
              value={destLat}
              onChange={(e) => setDestLat(e.target.value)}
            />
            <input
              className="p-2 border rounded w-full"
              placeholder="Longitude"
              value={destLng}
              onChange={(e) => setDestLng(e.target.value)}
            />
          </div>

          <label className="block text-sm">
            Expected delivery date
            <input
              type="date"
              className="mt-1 p-2 w-full border rounded"
              value={destExpectedDeliveryDate}
              onChange={(e) => setDestExpectedDeliveryDate(e.target.value)}
            />
          </label>
        </div>
      </div>

      {/* Dates, Image, Status and Actions row */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-gray-50 p-4 rounded border">
          <h4 className="font-medium mb-2">Dates</h4>
          <label className="block text-sm mb-2">
            Shipment date
            <input
              type="date"
              className="mt-1 p-2 w-full border rounded"
              value={shipmentDate}
              onChange={(e) => setShipmentDate(e.target.value)}
            />
          </label>

          <label className="block text-sm">
            Expected delivery
            <input
              type="date"
              className="mt-1 p-2 w-full border rounded"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
            />
          </label>
        </div>

        <div className="bg-gray-50 p-4 rounded border">
          <h4 className="font-medium mb-2">Image</h4>
          <ImageUploader
            initialUrl={imageUrl}
            onUploadComplete={(u) => setImageUrl(u)}
          />
        </div>

        <div className="bg-gray-50 p-4 rounded border">
          <h4 className="font-medium mb-2">Status & Actions</h4>
          <div className="space-y-2">
            <select
              className="p-2 w-full border rounded"
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

                // only set if changed (avoids unnecessary state churn)
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

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded"
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
                  className="px-3 py-2 bg-gray-100 rounded"
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
